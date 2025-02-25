from flask import Flask, request, jsonify
import pandas as pd
from openai import OpenAI
from dotenv import load_dotenv
import os
from pymongo import MongoClient

app = Flask(__name__)
load_dotenv()

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def get_mongo_client():
    mongo_uri = os.getenv("MONGO_URI")
    return MongoClient(mongo_uri)

def load_courses_from_mongo(db_name, collection_name):
    client = get_mongo_client()
    db = client[db_name]
    collection = db[collection_name]
    courses = pd.DataFrame(list(collection.find()))
    return courses


def limit_courses(courses, max_courses=300):
    return courses.sample(n=min(len(courses), max_courses), random_state=42)

def filter_courses(df, student_history, required_courses, ges_taken, upper_electives_group):

    df = df[
        ~df['General education'].isin(ges_taken) &
        (
            df['Course Code'].str.contains(r'CSE 1[0-6][0-9]') |
            df['Course Code'].str.split(' - ').str[0].isin([course for group in upper_electives_group for course in group]) |
            df['Course Code'].str.split(' - ').str[0].isin([course for group in required_courses for course in group]) |
            df.apply(lambda row: can_take_course(student_history, eval(row['Parsed Prerequisites']))[0], axis=1)
        )
    ]

    return df

def extract_prerequisites(df):
    prerequisites = df[['Course Code', 'Parsed Prerequisites']].dropna()
    prerequisites['Course Code'] = prerequisites['Course Code'].str.split(' - ').str[0]
    return prerequisites

def generate_schedule(courses, student_history, ge_history, required_courses, upper_electives_taken, upper_electives_needed, prerequisites, model="chatgpt-4o-latest"):
    
    course_list = "\n".join(
        f"{row.to_dict()}" 
        for _, row in courses.iterrows()
    )

    prompt = f"""
    Here is a list of available courses for next quarter:
    
    {course_list}
    
    The student has only taken the following courses:
    {student_history}

    The student has taken the following general education courses: 
    {ge_history}
    REMOVE GENERAL EDUCATION CLASSES FOR CONSIDERATION FROM THE COURSE LIST THAT THE STUDENT HAS ALREADY TAKEN.
    DO NOT RECOMMEND COURSES THAT THE STUDENT DOES NOT HAVE THE PREREQUISITES FOR IN THEIR HISTORY.
    The prerequisites for the courses are as follows:
    
    {prerequisites}

    REMOVE CLASSES FOR CONSIDERATION FROM THE COURSE LIST THAT THE STUDENT DOES NOT HAVE THE PREREQUISITES FOR.

    These are courses that the student still needs to take:

    {required_courses}
    prioritize courses that are prerequisites for future courses.
    
    This is the number of upper division electives the student has taken:
    {upper_electives_taken}
    Upper electives will be classes with course codes 100+.
    This is the number of upper division electives the student needs to take:
    {upper_electives_needed}

    Pick at least 3 classes that provide a balanced schedule based on variety, workload, and prerequisites and which completes their general education in a timely fashion.
    BE SURE TO INCLUDE THE REASON

    PICK AT LEAST ONE GENERAL EDUCATION COURSE THAT THE STUDENT HAS NOT TAKEN YET IF THE STUDENT HAS NOT TAKEN ALL GENERAL EDUCATION COURSES.
    Do not include classes that the student has general education credit for.
    
    Prioritize courses that are prerequisites for future courses.
    Ensure that the student meets all prerequisites for the selected courses.
    Do not include courses that the student has already taken.
    Do not recommend classes that require prerequisites that the student will take with the courses.
    Additionally, show which class and their times needs to be selected to provide a balanced schedule.
    If a class has discussion or lab sections, pick one that will be best for their schedule.
    """

    response = openai_client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are an expert academic advisor."},
            {"role": "user", "content": prompt},
        ],
    )
    
    response_message = response.choices[0].message.content

    return response_message


def get_student_history_ges(df, student_history):
    ges = df[df['Course Code'].str.split(' - ').str[0].isin(student_history)]['General education'].dropna().unique().tolist()
    ges = [ge for ge in ges if ge]
    return ges

def can_take_course(taken, prerequisites):
    for group in prerequisites:
        if not any(course in taken for course in group):
            return False
        
    return True, None 

def get_eligible_courses(data, student_history):
    eligible_courses = []
    for document in data:
        if 'Parsed Prerequisites' in document:
            prerequisites = document['Parsed Prerequisites']
            if isinstance(prerequisites, str):
                prerequisites = eval(prerequisites)

            eligible = can_take_course(student_history, prerequisites)

            if eligible and document['Course Code'] not in student_history:
                eligible_courses.append(document)

    return pd.DataFrame(eligible_courses)



def main():
    student_history = ["MATH 19A", "CSE 20", "PHYS 1B", "MATH 19B", "CSE 30", "HAVC 135H", "MATH 21", "CSE 16", "HIS 74A",
                       "AM 30", "CSE 12", "HAVC 64", "CSE 13S", "CSE 101", "CSE 40"]
    major = input("Enter your major: ")
    year = input("Enter the year of admission: ")
    db_name = "classes"
    collection_name = "courseInfo"
    client = get_mongo_client()
    db = client[db_name]
    collection = db[collection_name]
    data = list(collection.find())

    

    eligible_courses_df = get_eligible_courses(data, student_history)

    ge_history = get_student_history_ges(eligible_courses_df, student_history)

    courses = load_courses_from_mongo("university", "majors")

    major_data = courses[(courses['major'] == major) & (courses['admission_year'] == year)]
    if major_data.empty:
        raise ValueError(f"No data found for major: {major} and year: {year}")
        
    required_courses = major_data['required_courses'].iloc[0]
    upper_electives_group = major_data['uppder_div_categories'].iloc[0]

    courses_left = [course_group for course_group in required_courses 
                if not any(course in student_history for course in course_group)]
    

    required_ges = [ ["CC"], ["ER"], ["IM"], ["MF"], ["SI"], ["SR"], ["TA"], ["C"], ["DC"], ["PE-T, PE-H, PE-E"], ["PR-E", "PR-C", "PR-S"]]
 
    upper_electives_taken = 1
    upper_electives_needed = major_data['upper_electives_needed'].iloc[0] - upper_electives_taken


    filtered_courses = filter_courses(eligible_courses_df, student_history, required_courses, ges_taken = ge_history, upper_electives_group = upper_electives_group)
    limited_courses = limit_courses(filtered_courses)
    prerequisites = extract_prerequisites(limited_courses)
    schedule = generate_schedule(limited_courses, student_history=student_history, 
                                 ge_history=ge_history, required_courses=courses_left, 
                                 upper_electives_taken = upper_electives_taken, upper_electives_needed = upper_electives_needed,
                                 prerequisites=prerequisites)
    
    print("Suggested Schedule:")
    print(schedule)


if __name__ == "__main__":
    main()
