from flask import Flask, request, jsonify
import PyPDF2
import os
import sys
from flask_cors import CORS
from pymongo import MongoClient
import openai
from dotenv import load_dotenv
import re

app = Flask(__name__)
CORS(app)  # Allow frontend requests

openai.api_key = os.getenv("OPENAI_API_KEY")
openai_client = openai
UPLOAD_FOLDER = "/tmp"
ALLOWED_EXTENSIONS = {"pdf"}
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# Obtain MongoDB connection string from environment variables
mongo_connection_string = os.getenv("MONGO_URI")

# Initialize MongoDB client
client = MongoClient(mongo_connection_string)
# List of valid course codes
course_codes = [
    'ACEN', 'AM', 'ANTH', 'APLX', 'ARBC', 'ART', 'ARTG', 'ASTR', 'BIOC', 'BIOE',
    'BIOL', 'BME', 'CHEM', 'CHIN', 'CLNI', 'CLST', 'CMMU', 'CMPM', 'COWL', 'CRES',
    'CRSN', 'CT', 'CRWN', 'CSE', 'CSP', 'DANM', 'EART', 'ECE', 'ECON', 'EDUC',
    'ENVS', 'ESCI', 'FIL', 'FILM', 'FMST', 'FREN', 'GAME', 'GCH', 'GERM', 'GIST',
    'GRAD', 'GREE', 'HAVC', 'HEBR', 'HISC', 'HIS', 'HCI', 'HUMN', 'ITAL', 'JAPN',
    'JRLC', 'JWST', 'KRSG', 'LAAD', 'LALS', 'LATN', 'LGST', 'LING', 'LIT', 'MATH',
    'MERR', 'METX', 'MSE', 'MUSC', 'NLP', 'OAKS', 'OCEA', 'PBS', 'PERS', 'PHIL',
    'PHYE', 'PHYS', 'POLI', 'PORT', 'PRTR', 'PSYC', 'PUNJ', 'RUSS', 'SCIC', 'SOCD',
    'SOCY', 'SPAN', 'SPHS', 'STAT', 'STEV', 'THEA', 'TIM', 'UCDC', 'VAST', 'WRIT',
    'YIDD'
]

def allowed_file(filename):
    """Check if the uploaded file is a PDF."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file."""
    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            text = ''.join([page.extract_text() or "" for page in reader.pages])
        return text
    except Exception as e:
        print(f"Error reading PDF: {e}", file=sys.stderr)
        raise

def clean_text(text):
    """Clean and filter transcript text."""
    lines = text.split('\n')
    cleaned_lines = [
        line.strip() for line in lines 
        if line.strip() and not line.startswith(('***', 'Page:', 'Print Date:'))
    ]
    return cleaned_lines

def contains_any(main_string, string_array):
    """Check if any string in the array is found in the main string."""
    return any(substring in main_string for substring in string_array)

def parse_courses(cleaned_lines):
    """Parse courses from transcript text."""
    courses_by_quarter = {}
    current_quarter = None
    all_grades = {"A", "B", "C", "D", "F", "P", "NP", "W", "I", "IP"}

    for line in cleaned_lines:
        if 'Quarter' in line:
            current_quarter = line
            courses_by_quarter[current_quarter] = []
        elif current_quarter and any(subject in line for subject in course_codes):
            parts = line.split()

            if len(parts) >= 4:
                course_code = ' '.join(parts[0:2])

                if not contains_any(parts[-2], all_grades):
                    course_name = ' '.join(parts[2:-3])
                    credits_earned = parts[-2]
                    grade = "IP"
                else:
                    course_name = ' '.join(parts[2:-4])
                    credits_earned = parts[-3]
                    grade = parts[-2]

                courses_by_quarter[current_quarter].append({
                    'course_code': course_code,
                    'course_name': course_name,
                    'credits_earned': credits_earned,
                    'grade': grade
                })
    return courses_by_quarter

def extract_major(cleaned_lines):
    """Extract the declared major from transcript text."""
    matching_lines = [line for line in cleaned_lines if 'Plan:' in line]
    return matching_lines[-2].split('Plan:')[-1].strip() if len(matching_lines) >= 2 else "Unknown"


def generate_schedule(courses, student_history, required_courses, upper_electives_taken, upper_electives_needed, prerequisites, model="chatgpt-4o-latest"):
    

    prompt = f"""
    Here is a list of available courses for next quarter:
    
    {courses}
    
    The student has only taken the following courses:
    {student_history}

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
    PRIORITIZE REQUIRED CLASSES.
    INCLUDE JUST THE COURSE CODES and nothing else, classes that end in L are not classes.

    
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

@app.route('/upload', methods=['POST'])
def upload_pdf():
    """Handle file upload and processing."""
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file uploaded"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"success": False, "error": "Invalid file type. Only PDFs allowed"}), 400

    file_path = os.path.join(app.config["UPLOAD_FOLDER"], file.filename)
    file.save(file_path)

    try:
        text = extract_text_from_pdf(file_path)
        cleaned_lines = clean_text(text)
        courses_by_quarter = parse_courses(cleaned_lines)
        major = extract_major(cleaned_lines)

        # Student history in the form of course codes in list format
        student_history = []
        for quarter, courses in courses_by_quarter.items():
            for course in courses:
                student_history.append(course['course_code'])
        
        # Year of admission
        year_of_admission = list(courses_by_quarter.keys())[0].split(" ")[0]

        # Extract the major from the cleaned lines
        major = extract_major(cleaned_lines)

        db = client["university"]  # Name of your MongoDB database
        collection = db['majors']
        query = {"major": major, "admission_year": year_of_admission}

        db2 = client["course"]
        collection2 = db2['classInfo']
        class_codes = collection2.find({}, {"Class Code": 1, "_id": 0})
        class_code_list = [class_code.get("Class Code") for class_code in class_codes]
        
        curriculum = collection.find_one(query)
        
        remaining_upper_div_courses = []
        remaining_required_courses = []
        upper_div_electives_taken = 0

        if curriculum:
            required_courses = curriculum.get("required_courses", [])
            for course_group in required_courses:
                if not any(course in student_history for course in course_group):
                    remaining_required_courses.append(course_group)
            upper_div_categories = curriculum.get("upper_div_categories", [])
            for category_name, courses in upper_div_categories.items():
                for course_group in courses:
                    for course in course_group:
                        if course in student_history:
                            upper_div_electives_taken += 1
                            print(f"Course taken: {course}")
                        if course not in student_history:
                            remaining_upper_div_courses.append(course)
        else:
            return jsonify({"success": False, "error": f"No curriculum found for {major} and year {year_of_admission}"}), 404
        
        # Get common courses that are available this quarter
        common_courses = [course for course in remaining_upper_div_courses if course in class_code_list]
        
        # Get the prerequisites for the common courses
        prerequisites_cursor = collection2.find({"Class Code": {"$in": common_courses}}, {"Class Code": 1, "Prereqs": 1, "_id": 0})
        prerequisites = {doc["Class Code"]: doc.get("Prereqs", "None") for doc in prerequisites_cursor}

        # Generate the schedule
        schedule = generate_schedule(courses=common_courses, student_history=student_history, required_courses=remaining_required_courses, upper_electives_taken=upper_div_electives_taken, upper_electives_needed=remaining_upper_div_courses, prerequisites=prerequisites)

        # Extract courses from the schedule
        course_codes = re.findall(r'[A-Z]{2,4} \d{2,3}[A-Z]*', schedule)
        
        # Fetch course information from MongoDB
        course_info_list = []
        for course_code in course_codes:
            course_info = collection2.find_one({"Class Code": course_code}, {"_id": 0})
            if course_info:
                course_info_list.append(course_info)

        return jsonify({
            "success": True,
            "data": {
                "major": major,
                "courses_by_quarter": courses_by_quarter,
                "upper_div_electives_taken": upper_div_electives_taken,
                "remaining_upper_div_courses": remaining_upper_div_courses,
                "remaining_required_courses": remaining_required_courses,
                "recommended_courses": course_info_list  # Add this line to include course information
            }
        }), 200
    except Exception as e:
        print(f"Error processing file: {e}", file=sys.stderr)
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

if __name__ == "__main__":
    app.run(debug=True)
