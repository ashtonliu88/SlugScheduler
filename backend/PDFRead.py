from flask import Flask, request, jsonify
import PyPDF2
import os
import sys
from flask_cors import CORS
from pymongo import MongoClient
from dotenv import load_dotenv

app = Flask(__name__)
CORS(app)  # Allow frontend requests

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

        #studnet history in the form of course codes in list format
        student_history = []
        for quarter, courses in courses_by_quarter.items():
            for course in courses:
                student_history.append(course['course_code'])
        
        #year of admission
        year_of_admission = list(courses_by_quarter.keys())[0].split(" ")[0]

        # Extract the major from the cleaned lines
        major = extract_major(cleaned_lines)

        db = client["university"]  # Name of your MongoDB database
        collection = db['majors']
        query = {"major": major, "admission_year": year_of_admission}
        curriculum = collection.find_one(query)
        
        if curriculum:
            required_courses = curriculum.get("required_courses", [])
            upper_div_categories = curriculum.get("upper_div_categories", [])
            upper_div_electives_taken = 0
            for category_name, courses in upper_div_categories.items():
                print(f"\nCategory: {category_name}")
                for course_group in courses:
                    for course in course_group:
                        if course in student_history:
                            upper_div_electives_taken += 1
                            print(f"Course taken: {course}")
            
            print(f"\nUpper division electives taken: {upper_div_electives_taken}")
        else:
            print(f"No curriculum found for major: {major}, year: {year_of_admission}")

        return jsonify({
            "success": True,
            "data": {
                "major": major,
                "courses_by_quarter": courses_by_quarter
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
