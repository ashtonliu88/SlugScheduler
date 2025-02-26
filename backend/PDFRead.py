import PyPDF2
import json
import sys
import os

# Array of all course codes
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

def extract_text_from_pdf(pdf_path):
    with open(pdf_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        text = ''
        for page in reader.pages:
            text += page.extract_text()
    return text

def contains_any(main_string, string_array):
    return any(substring in main_string for substring in string_array)

def clean_text(text):
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        if line.strip() and not line.startswith('***') and not line.startswith('Page:') and not line.startswith('Print Date:'):
            cleaned_lines.append(line.strip())
    return cleaned_lines

def parse_courses(cleaned_lines):
    courses_by_quarter = {}
    current_quarter = None
    all_grades = ["A", "B", "C", "D", "F", "P", "NP", "W", "I", "IP"]

    for line in cleaned_lines:
        # Check if the line indicates a new quarter
        if 'Quarter' in line:
            current_quarter = line
            courses_by_quarter[current_quarter] = []
        # Check if the line contains course information by searching for any course code
        elif current_quarter is not None and any(subject in line for subject in course_codes):
            # Split the line into parts
            parts = line.split()

            if len(parts) >= 4:
                # Extract course code (first part)
                course_code = ' '.join(parts[0:2])
                # Extract course name (everything between the course code and the credits)

                # Extract credits earned and grade
                if not contains_any(parts[-2], all_grades):
                    course_name = ' '.join(parts[2:-3])
                    credits_earned = parts[-2]
                    grade = "IP"
                else:
                    course_name = ' '.join(parts[2:-4])
                    credits_earned = parts[-3]
                    grade = parts[-2]

                # Add the course to the current quarter
                courses_by_quarter[current_quarter].append({
                    'course_code': course_code,
                    'course_name': course_name,
                    'credits_earned': credits_earned,
                    'grade': grade
                })
    return courses_by_quarter

def extract_major(cleaned_lines):
    major = None
    matching_lines = []
    for line in cleaned_lines:
        if 'Plan:' in line:
            matching_lines.append(line)
    

    major = matching_lines[-2].split('Plan:')[-1].strip()
    return major

def main(pdf_path):
    try:
        text = extract_text_from_pdf(pdf_path)
        cleaned_lines = clean_text(text)
        courses_by_quarter = parse_courses(cleaned_lines)
        major = extract_major(cleaned_lines)
        data = {
        'major': major,
        'courses_by_quarter': courses_by_quarter
    }
        major = extract_major(cleaned_lines)
        return json.dumps({"success": True, "data": data}, indent=2)
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"success": False, "error": "Usage: python PDFRead.py <path_to_pdf>"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(json.dumps({"success": False, "error": f"File not found: {pdf_path}"}))
        sys.exit(1)
    
    result = main(pdf_path)
    print(result)

