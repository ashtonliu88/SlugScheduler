#pdfread.py
from flask import Flask, request, jsonify
import PyPDF2
import os
import sys
from flask_cors import CORS
from pymongo import MongoClient
import openai
from dotenv import load_dotenv
import re
import json

app = Flask(__name__)
CORS(app)  # Allow frontend requests

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

openai.api_key = os.getenv("OPENAI_API_KEY")
openai_client = openai
UPLOAD_FOLDER = "/tmp"
ALLOWED_EXTENSIONS = {"pdf"}
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Obtain MongoDB connection string from environment variables
mongo_connection_string = os.getenv("MONGO_URI")

# Initialize MongoDB client
client = MongoClient(mongo_connection_string)

# Collection for storing recommended courses
RECOMMENDED_COURSES = 'course-assistant-recommended-courses'

# List of valid course codes
course_codes = [
    'ACEN', 'AM', 'ANTH', 'APLX', 'ARBC', 'ART', 'ARTG', 'ASTR', 'BIOC', 'BIOE',
    'BIOL', 'BME', 'CHEM', 'CHIN', 'CLNI', 'CLST', 'CMMU', 'CMPM', 'COWL', 'CRES',
    'CRSN', 'CT', 'CRWN', 'CSE', 'ECE', 'ECON', 'EDUC',
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

def extract_major_and_type(degree):
    degree = degree.strip()

    pattern = (
        r'^(?:'
        r'(BS|BA|B\.S\.|B\.A\.|Bachelor of Science|Bachelor of Arts)\s*(in\s*)?|'
        r'()'
        r')'
        r'([A-Za-z\s]+?)'
        r'(?:\s*\((BS|BA|B\.S\.|B\.A\.)\))?$'
    )
    
    match = re.match(pattern, degree, re.IGNORECASE)

    if not match:
        return {"major": degree, "type": "Unknown"}

    degree_type, in_word, _, major, degree_suffix = match.groups()

    degree_type = degree_type or degree_suffix
    if degree_type:
        degree_type = degree_type.replace('.', '').upper()
    else:
        degree_type = 'Unknown'

    major = major.strip().title()

    return {"major": major, "type": degree_type}

def query_courses_by_criteria(criteria):
    """Query courses from MongoDB based on given criteria."""
    db = client["course"]
    collection = db['classInfo']
    
    query = {}
    
    # Subject area filter
    if criteria.get('subject'):
        subject_regex = f"^{criteria['subject']}"
        query['Class Code'] = {'$regex': subject_regex}
    
    # Excluded subject areas
    if criteria.get('excluded_subjects') and len(criteria['excluded_subjects']) > 0:
        excluded_patterns = [f"^{subj}" for subj in criteria['excluded_subjects']]
        if 'Class Code' not in query:
            query['Class Code'] = {}
        
        if '$regex' in query['Class Code']:
            existing_regex = query['Class Code']['$regex']
            query['Class Code'] = {
                '$regex': existing_regex,
                '$not': {'$in': excluded_patterns}
            }
        else:
            query['Class Code'] = {'$not': {'$in': excluded_patterns}}
    
    # Time of day filter
    if criteria.get('time_of_day'):
        time_pattern = {
            'morning': {'$regex': r'AM'},
            'afternoon': {'$regex': r'12:00PM|1:00PM|2:00PM|3:00PM|4:00PM'},
            'evening': {'$regex': r'5:00PM|6:00PM|7:00PM|8:00PM|9:00PM'}
        }.get(criteria['time_of_day'])
        
        if time_pattern:
            query['Days & Times'] = time_pattern
    
    # Days of week filter
    if criteria.get('days'):
        days_pattern = criteria['days']
        if days_pattern == 'MWF':
            query['Days & Times'] = {'$regex': r'M.*W.*F'}
        elif days_pattern == 'TR':
            query['Days & Times'] = {'$regex': r'T.*R'}
    
    # GE requirement filter
    if criteria.get('ge'):
        query['GE'] = {'$regex': criteria['ge']}
    
    # Difficulty level filter (this would need additional data or analysis)
    if criteria.get('level'):
        level_map = {
            'introductory': {'$regex': r' [1-9][0-9]$'},
            'intermediate': {'$regex': r' 1[0-9][0-9]$'},
            'advanced': {'$regex': r' 2[0-9][0-9]$'}
        }.get(criteria['level'])
        
        if level_map:
            if 'Class Code' in query:
                # Handle complex queries where we already have Class Code filters
                # This would require a more sophisticated approach with $and operators
                pass
            else:
                query['Class Code'] = level_map
    
    if criteria.get('open_only') and criteria['open_only']:
        query['Status'] = 'Open'
    
    
    print(f"MongoDB Query: {query}")
    
    if 'Class Code' in query and isinstance(query['Class Code'], dict) and len(query['Class Code']) > 1:
        conditions = []
        for key, value in query['Class Code'].items():
            conditions.append({f'Class Code.{key}': value})
        query = {'$and': conditions}
    
    courses = list(collection.find(query, {'_id': 0}).limit(10))
    
    if not courses and criteria.get('excluded_subjects'):
        backup_query = {k: v for k, v in query.items() if k != 'Class Code'}
        backup_courses = list(collection.find(backup_query, {'_id': 0}).limit(10))
        
        # Filter out excluded subjects manually
        if backup_courses:
            excluded_subjects = criteria.get('excluded_subjects', [])
            filtered_courses = [
                course for course in backup_courses 
                if not any(course.get('Class Code', '').startswith(subj) for subj in excluded_subjects)
            ]
            
            if filtered_courses:
                return filtered_courses
    

    if not courses and criteria.get('from_potential_upper_div_list') and 'remaining_upper_div_courses' in student_info:
        potential_courses = student_info['remaining_upper_div_courses']
        
        # Filter out excluded subjects if necessary
        if criteria.get('excluded_subjects'):
            excluded_subjects = criteria.get('excluded_subjects', [])
            potential_courses = [
                course for course in potential_courses 
                if not any(course.startswith(subj) for subj in excluded_subjects)
            ]
        
        if potential_courses:
            upper_div_courses = list(collection.find(
                {"Class Code": {"$in": potential_courses}}, 
                {'_id': 0}
            ).limit(10))
            
            return upper_div_courses
    
    return courses


def extract_recommendation_criteria(message):
    """Extract course recommendation criteria from user message using OpenAI."""
    extraction_prompt = f"""
    Extract course recommendation criteria from this message:
    "{message}"
    
    Return a JSON object with these fields (use null if not mentioned):
    - subject: the department code or subject area (like CSE, MATH, etc.)
    - excluded_subjects: array of department codes that should be excluded (if user wants to avoid certain departments)
    - time_of_day: one of [morning, afternoon, evening, null]
    - days: one of [MWF, TR, null] (MWF = Monday/Wednesday/Friday, TR = Tuesday/Thursday)
    - level: one of [introductory, intermediate, advanced, null]
    - ge: any mentioned general education requirement code
    - open_only: boolean, true if user only wants courses with open seats
    - difficulty: one of [easy, moderate, challenging, null]
    - interest_keywords: array of keywords related to topics they're interested in
    
    Only include the JSON in your response, no other text.
    
    Examples:
    - For "Give me other classes than AM classes", include ["AM"] in excluded_subjects
    - For "I don't want any MATH or PHYS courses", include ["MATH", "PHYS"] in excluded_subjects
    """
    
    response = openai_client.chat.completions.create(
        model="chatgpt-4o-latest",
        messages=[
            {"role": "system", "content": "You are a criteria extraction system."},
            {"role": "user", "content": extraction_prompt},
        ],
    )
    
    # Parse the JSON response
    try:
        extracted_criteria = json.loads(response.choices[0].message.content)
        return extracted_criteria
    except Exception as e:
        print(f"Error parsing criteria JSON: {e}")
        return {}


def format_course_recommendations(courses, criteria, student_history=None):
    """Format course recommendations with OpenAI assistance."""
    if not courses:
        if not criteria.get('from_potential_upper_div_list'):
            criteria['from_potential_upper_div_list'] = True
            upper_div_courses = query_courses_by_criteria(criteria)
            
            if upper_div_courses:
                return format_course_recommendations(upper_div_courses, criteria, student_history)
        
        return "I couldn't find any courses matching your criteria. Could you try with different requirements?"
    
    courses_text = "\n".join([
        f"- {course['Class Code']}: {course['Class Name']} ({course.get('Credits', 'N/A')} credits)\n"
        f"  Times: {course.get('Days & Times', 'Not specified')}\n"
        f"  Description: {course.get('Description', 'No description available.')[:200]}...\n"
        f"  Prerequisites: {course.get('Prereqs', 'None')}\n"
        for course in courses
    ])
    
    history_text = ""
    if student_history:
        history_text = f"The student has previously taken: {', '.join(student_history)}"
    
    exclusion_text = ""
    if criteria.get('excluded_subjects'):
        exclusion_text = f"The student specifically asked to AVOID courses from these departments: {', '.join(criteria['excluded_subjects'])}"
    
    prompt = f"""
    A student is looking for course recommendations with these preferences:
    {json.dumps(criteria, indent=2)}
    
    {history_text}
    
    {exclusion_text}
    
    These courses match their criteria:
    {courses_text}
    
    Provide a personalized response recommending 3-5 of these courses, explaining:
    1. Why each course fits their preferences
    2. Any special considerations about timing, prerequisites, or workload
    3. How these courses might work together in a schedule
    
    Format each recommendation clearly with the course code, name, and brief explanation.
    
    IMPORTANT: Strictly avoid recommending any courses from departments the student asked to exclude.
    """
    
    response = openai_client.chat.completions.create(
        model="chatgpt-4o-latest",
        messages=[
            {"role": "system", "content": "You are a helpful academic advisor for UC Santa Cruz."},
            {"role": "user", "content": prompt},
        ],
    )
    
    return response.choices[0].message.content

def is_recommendation_request(message):
    """Determine if a message is asking for course recommendations."""
    recommendation_keywords = [
        "recommend", "suggest", "courses", "classes", "next quarter", 
        "should take", "good classes", "what classes", "which courses",
        "looking for classes", "need a class", "find me", "course recommendation",
        "give me classes", "give me other classes", "show me courses", 
        "courses besides", "classes other than"
    ]
    
    message_lower = message.lower()
    return any(keyword in message_lower for keyword in recommendation_keywords)

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

        student_history = []
        for quarter, courses in courses_by_quarter.items():
            for course in courses:
                student_history.append(course['course_code'])
        

        global current_student_history
        current_student_history = student_history
        
        # Year of admission
        year_of_admission = list(courses_by_quarter.keys())[0].split(" ")[0]

        # Extract the major from the cleaned lines
        major = extract_major(cleaned_lines)
        major_info = extract_major_and_type(major)
        major_name = major_info["major"]
        major_type = major_info["type"]

        db = client["university"]  # Name of your MongoDB database
        collection = db['majors']
        query = {"major": major_name, "admission_year": year_of_admission, "type": major_type}

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
                        if course not in student_history:
                            remaining_upper_div_courses.append(course)
        else:
            return jsonify({"success": False, "error": f"No curriculum found for {major} and year {year_of_admission}"}), 404
        
        common_courses = [course for course in remaining_upper_div_courses if course in class_code_list]
        
        prerequisites_cursor = collection2.find({"Class Code": {"$in": common_courses}}, {"Class Code": 1, "Prereqs": 1, "_id": 0})
        prerequisites = {doc["Class Code"]: doc.get("Prereqs", "None") for doc in prerequisites_cursor}

        # Generate the schedule
        schedule = generate_schedule(courses=common_courses, student_history=student_history, required_courses=remaining_required_courses, upper_electives_taken=upper_div_electives_taken, upper_electives_needed=remaining_upper_div_courses, prerequisites=prerequisites)
        course_codes = re.findall(r'[A-Z]{2,4} \d{2,3}[A-Z]*', schedule)
        
        # Fetch course information from MongoDB
        course_info_list = []
        for course_code in course_codes:
            course_info = collection2.find_one({"Class Code": course_code}, {"_id": 0})
            if course_info:
                formatted_course = {
                    "Class Code": course_info.get("Class Code", ""),
                    "Class Name": course_info.get("Class Name", ""),
                    "Class Type": course_info.get("Class Type", "Undergraduate"),
                    "Credits": course_info.get("Credits", ""),
                    "Days & Times": course_info.get("Days & Times", ""),
                    "Room": course_info.get("Room", ""),
                    "Instructors": course_info.get("Instructors", ""),
                    "Description": course_info.get("Description", "No description available."),
                    "Prereqs": course_info.get("Prereqs", "")
                }
                course_info_list.append(formatted_course)
        
        # Save recommended courses to dedicated collection
        recommended_db = client["course"]
        recommended_collection = recommended_db[RECOMMENDED_COURSES]
        
        # Create a unique student identifier (using a hash of their history or some other identifier)
        student_id = hash(str(student_history))
        
        # Store recommended courses with student identifier
        recommended_collection.update_one(
            {"student_id": student_id},
            {"$set": {
                "student_id": student_id,
                "major": major_name,
                "type": major_type,
                "recommended_courses": course_info_list,
                "last_updated": os.popen('date "+%Y-%m-%d %H:%M:%S"').read().strip()
            }},
            upsert=True
        )

        global student_info
        student_info = {
            "major": major_name,
            "type": major_type,
            "student_history": student_history,
            "remaining_required_courses": remaining_required_courses,
            "remaining_upper_div_courses": remaining_upper_div_courses,
            "student_id": student_id
        }

        return jsonify({
            "success": True,
            "data": {
                "major": major_name,
                "type": major_type,
                "courses_by_quarter": courses_by_quarter,
                "upper_div_electives_taken": upper_div_electives_taken,
                "remaining_upper_div_courses": remaining_upper_div_courses,
                "remaining_required_courses": remaining_required_courses,
                "recommended_courses": course_info_list
            }
        }), 200
    except Exception as e:
        print(f"Error processing file: {e}", file=sys.stderr)
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

student_info = {
    "major": None,
    "type": None,
    "student_history": [],
    "remaining_required_courses": [],
    "remaining_upper_div_courses": [],
    "student_id": None
}

student_preferences = {
    "preferredTimeOfDay": "any",
    "workloadPreference": "balanced",
    "interestAreas": [],
    "preferredDays": [],
    "preferredUnitsPerQuarter": 15,
    "preferGaps": False,
    "preferConsecutiveClasses": False
}

def is_schedule_request(message):
    """Determine if a message is asking for schedule recommendations."""
    schedule_keywords = [
        "schedule", "timetable", "class schedule", "next quarter", 
        "plan my classes", "plan my courses", "schedule builder",
        "what should my schedule be", "recommend a schedule",
        "help me plan", "organize my classes", "build me a schedule",
        "create a schedule", "balance my schedule", "optimal schedule",
        "best schedule", "good schedule", "manageable schedule",
        "change my schedule", "update my schedule", "modify my schedule",
        "adjust my schedule", "new schedule"
    ]
    
    message_lower = message.lower()
    return any(keyword in message_lower for keyword in schedule_keywords)

def extract_schedule_preferences(message):
    """Extract schedule preferences from user message using OpenAI."""
    extraction_prompt = f"""
    Extract schedule preferences from this message:
    "{message}"
    
    Return a JSON object with these fields (use null if not mentioned):
    - maxClassesPerDay: integer (1-5)
    - preferredDaysOff: array of days (M, T, W, R, F)
    - earliestStartTime: time (e.g., "8:00 AM")
    - latestEndTime: time (e.g., "5:00 PM") 
    - workloadPreference: one of [light, balanced, challenging]
    - breakBetweenClasses: boolean or minutes (true, false, or number of minutes)
    - preferredSubjects: array of department codes the student wants to focus on
    - avoidSubjects: array of department codes to avoid
    - includeRequiredCourses: boolean (true if they want to prioritize required courses)
    - includeUpperDivision: boolean (true if they specifically want upper division courses)
    - preferGEs: boolean (true if they want to include General Education requirements)
    - totalUnits: preferred number of units for the quarter (typically 12-19)
    
    Only include the JSON in your response, no other text.
    """
    
    response = openai_client.chat.completions.create(
        model="chatgpt-4o-latest",
        messages=[
            {"role": "system", "content": "You are a preference extraction system."},
            {"role": "user", "content": extraction_prompt},
        ],
    )
    
    try:
        extracted_preferences = json.loads(response.choices[0].message.content)
        return extracted_preferences
    except Exception as e:
        print(f"Error parsing schedule preferences JSON: {e}")
        return {}

def extract_and_store_preferences(message):
    """Extract and store student preferences from message."""
    extraction_prompt = f"""
    Extract the student's course preferences from this message:
    "{message}"
    
    Return a JSON object with these fields (leave empty if not mentioned):
    - preferredTimeOfDay: one of [morning, afternoon, evening, any]
    - workloadPreference: one of [light, balanced, challenging]
    - interestAreas: array of subject areas they're interested in
    - preferredDays: array of preferred days (MWF, TR, etc.)
    - preferredUnitsPerQuarter: number (typically 12-19)
    - preferGaps: boolean (whether they like breaks between classes)
    - preferConsecutiveClasses: boolean (whether they like classes back-to-back)
    
    Only include the JSON in your response, no other text.
    """
    
    response = openai_client.chat.completions.create(
        model="chatgpt-4o-latest",
        messages=[
            {"role": "system", "content": "You are a preference extraction system."},
            {"role": "user", "content": extraction_prompt},
        ],
    )
    
    try:
        extracted_preferences = json.loads(response.choices[0].message.content)
        
        global student_preferences
        student_preferences = extracted_preferences
        
        return extracted_preferences
    except Exception as e:
        print(f"Error parsing preferences: {e}")
        return {}

def generate_personalized_schedule(preferences, student_history, required_courses, major, student_id=None):
    """Generate a personalized schedule based on student preferences."""
    db = client["course"]
    collection = db['classInfo']
    
    query = {}
    
    # Add filters based on preferences
    if preferences.get('preferredSubjects'):
        subject_patterns = [f"^{subj}" for subj in preferences['preferredSubjects']]
        query['Class Code'] = {'$regex': {'$in': subject_patterns}}
    
    if preferences.get('avoidSubjects'):
        avoid_patterns = [f"^{subj}" for subj in preferences['avoidSubjects']]
        if 'Class Code' in query:
            query['$and'] = [
                {'Class Code': query['Class Code']},
                {'Class Code': {'$not': {'$in': avoid_patterns}}}
            ]
            del query['Class Code']
        else:
            query['Class Code'] = {'$not': {'$in': avoid_patterns}}
    
    time_query = {}
    if preferences.get('earliestStartTime'):
        # This would need more sophisticated time comparison logic
        pass
    
    if preferences.get('latestEndTime'):
        # This would need more sophisticated time comparison logic
        pass
    
    if preferences.get('preferredDaysOff'):
        days_to_avoid = preferences['preferredDaysOff']
        day_patterns = []
        for day in days_to_avoid:
            day_patterns.append({'Days & Times': {'$not': {'$regex': day}}})
        
        if day_patterns:
            if '$and' not in query:
                query['$and'] = []
            query['$and'].extend(day_patterns)
    
    # Get available courses
    available_courses = list(collection.find(query, {'_id': 0}))
    
    # Filter out courses student
    
    # Filter out courses student has already taken
    available_courses = [course for course in available_courses 
                         if course.get('Class Code') not in student_history]
    
    # Extract required courses the student still needs to take
    flattened_required = []
    for course_group in required_courses:
        if isinstance(course_group, list):
            flattened_required.extend(course_group)
        else:
            flattened_required.append(course_group)
    
    # Filter for required courses if requested
    required_available = []
    if preferences.get('includeRequiredCourses', True):
        required_available = [course for course in available_courses 
                              if course.get('Class Code') in flattened_required]
    
    # Generate schedule using OpenAI
    course_list = "\n".join([
        f"- {course.get('Class Code', 'Unknown')}: {course.get('Class Name', 'Unknown')} "
        f"({course.get('Credits', 'Unknown')} units) - {course.get('Days & Times', 'Unknown')}"
        for course in available_courses[:30]  # Limit to 30 to not overload the prompt
    ])
    
    required_list = "\n".join([
        f"- {course.get('Class Code', 'Unknown')}: {course.get('Class Name', 'Unknown')} "
        f"({course.get('Credits', 'Unknown')} units) - {course.get('Days & Times', 'Unknown')}"
        for course in required_available
    ]) if required_available else "No required courses available this quarter."
    
    target_units = preferences.get('totalUnits', 15)
    
    # Prepare prompt for schedule generation
    schedule_prompt = f"""
    Generate a personalized course schedule for a {major} major student with these preferences:
    {json.dumps(preferences, indent=2)}
    
    The student has already taken these courses: {', '.join(student_history)}
    
    Required courses available this quarter:
    {required_list}
    
    Other available courses (sample):
    {course_list}
    
    Create a balanced schedule with approximately {target_units} units that:
    1. Prioritizes required courses for their major if requested
    2. Respects their preferred days/times
    3. Balances workload across the week
    4. Avoids time conflicts
    5. Includes appropriate breaks between classes if requested
    6. Ensures prerequisites are met based on their history
    
    Format the schedule by day of week, showing course code, name, time, location, and units.
    Also provide a brief explanation of why this schedule would work well for them.
    """
    
    response = openai_client.chat.completions.create(
        model="chatgpt-4o-latest",
        messages=[
            {"role": "system", "content": "You are an expert academic scheduler."},
            {"role": "user", "content": schedule_prompt},
        ],
    )
    
    return response.choices[0].message.content


@app.route('/refine_schedule', methods=['POST'])
def refine_schedule():
    """Endpoint for refining a suggested schedule based on student feedback."""
    data = request.json
    current_schedule = data.get('current_schedule', '')
    feedback = data.get('feedback', '')
    
    refine_prompt = f"""
    The student currently has this schedule:
    {current_schedule}
    
    They've provided this feedback or requested these changes:
    "{feedback}"
    
    Adjust the schedule to better meet their needs. Consider:
    1. Adding or removing specific courses
    2. Adjusting time slots
    3. Balancing the workload
    4. Addressing any specific concerns they raised
    
    Provide the revised schedule and explain the changes made.
    """
    
    response = openai_client.chat.completions.create(
        model="chatgpt-4o-latest",
        messages=[
            {"role": "system", "content": "You are an expert academic scheduler."},
            {"role": "user", "content": refine_prompt},
        ],
    )
    
    return jsonify({
        "response": response.choices[0].message.content
    })

@app.route('/compare_schedules', methods=['POST'])
def compare_schedules():
    """Endpoint for comparing multiple possible schedules."""
    data = request.json
    schedules = data.get('schedules', [])
    
    if not schedules or len(schedules) < 2:
        return jsonify({"success": False, "error": "Need at least two schedules to compare"}), 400
    
    comparison_prompt = f"""
    Compare these possible course schedules:
    
    {json.dumps(schedules, indent=2)}
    
    For each schedule, analyze:
    1. Total units and workload balance
    2. Daily time commitment
    3. Subject variety
    4. Progress toward degree requirements
    5. Potential challenges or conflicts
    
    Recommend which schedule would be best overall and explain why.
    Also identify pros and cons of each option.
    """
    
    response = openai_client.chat.completions.create(
        model="chatgpt-4o-latest",
        messages=[
            {"role": "system", "content": "You are an expert academic scheduler."},
            {"role": "user", "content": comparison_prompt},
        ],
    )
    
    return jsonify({
        "success": True,
        "comparison": response.choices[0].message.content
    })

@app.route('/chat', methods=['POST'])
def chat():
    """Handle chat messages and provide schedule recommendations."""
    data = request.json
    message = data.get('message', '')
    
    # Check if this is a schedule recommendation request
    if is_schedule_request(message):
        preferences = extract_schedule_preferences(message)
        
        schedule_response = generate_personalized_schedule(
            preferences, 
            student_info.get("student_history", []),
            student_info.get("remaining_required_courses", []),
            student_info.get("major", "Unknown")
        )
        
        return jsonify({
            "response": schedule_response
        })
    
    
    elif any(keyword in message.lower() for keyword in ["prefer", "like", "enjoy", "interested in"]):
        
        extracted_preferences = extract_and_store_preferences(message)
        
        return jsonify({
            "response": f"I've noted your preferences:\n" +
                        f"- Time of day: {extracted_preferences.get('preferredTimeOfDay', 'Not specified')}\n" +
                        f"- Days: {', '.join(extracted_preferences.get('preferredDays', ['Not specified']))}\n" +
                        f"- Workload: {extracted_preferences.get('workloadPreference', 'Not specified')}\n" +
                        f"- Interests: {', '.join(extracted_preferences.get('interestAreas', []))}\n\n" +
                        f"I'll adjust my schedule recommendations accordingly."
        })
    
    
    chat_prompt = f"""
    The student is asking: "{message}"
    
    Student information:
    - Major: {student_info.get('major', 'Unknown')}
    - Type: {student_info.get('type', 'Unknown')}
    - Courses taken: {', '.join(student_info.get('student_history', ['Unknown']))}
    
    You are a helpful schedule assistant for UC Santa Cruz students.
    Provide a helpful, concise response about course scheduling, requirements, or general academic advice.
    """
    
    response = openai_client.chat.completions.create(
        model="chatgpt-4o-latest",
        messages=[
            {"role": "system", "content": "You are a helpful academic advisor for UC Santa Cruz."},
            {"role": "user", "content": chat_prompt},
        ],
    )
    
    return jsonify({
        "response": response.choices[0].message.content
    })

@app.route('/specific_recommendations', methods=['POST'])
def specific_recommendations():
    """Endpoint for getting recommendations with specific criteria."""
    data = request.json
    criteria = data.get('criteria', {})
    
    if not criteria:
        return jsonify({"success": False, "error": "No criteria provided"}), 400
    
    
    courses = query_courses_by_criteria(criteria)
    
    
    recommendation_response = format_course_recommendations(
        courses, 
        criteria, 
        student_info.get("student_history")
    )
    
    return jsonify({
        "success": True,
        "recommendations": recommendation_response,
        "courses": courses
    })

if __name__ == "__main__":
    app.run(debug=True)