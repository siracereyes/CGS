
export enum Role {
  TEACHER = 'Teacher', // Renamed from Subject Teacher, implies general teaching role
  HEAD_TEACHER = 'Head Teacher',
  ADMIN = 'Admin'
}

export enum Subject {
  ENGLISH = 'English',
  MATHEMATICS = 'Mathematics',
  SCIENCE = 'Science',
  FILIPINO = 'Filipino',
  ARALING_PANLIPUNAN = 'Araling Panlipunan',
  ESP_VALUES = 'ESP/Values Education',
  MAPEH = 'MAPEH',
  TLE = 'Technology and Livelihood Education'
}

export enum GradeLevel {
  GRADE_1 = 'Grade 1',
  GRADE_2 = 'Grade 2',
  GRADE_3 = 'Grade 3',
  GRADE_4 = 'Grade 4',
  GRADE_5 = 'Grade 5',
  GRADE_6 = 'Grade 6',
  GRADE_7 = 'Grade 7',
  GRADE_8 = 'Grade 8',
  GRADE_9 = 'Grade 9',
  GRADE_10 = 'Grade 10',
  GRADE_11 = 'Grade 11',
  GRADE_12 = 'Grade 12'
}

export interface RegistrationData {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  role: Role | '';
  mainSubject: Subject | '';
  mainGradeLevel: GradeLevel | '';
  hasMultipleGrades: boolean;
  additionalGrades: GradeLevel[];
}

export interface Student {
  id?: string;
  // Basic Info
  lrn: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  extension_name: string;
  grade_level: string;
  section: string;
  
  // Demographics
  sex: 'M' | 'F' | '';
  birth_date: string;
  age: number | '';
  birth_place: string;
  religion: string;
  
  // Address
  address_house_no: string;
  address_barangay: string;
  address_municipality: string;
  address_province: string;
  address_zip: string;
  
  // Parents/Guardian
  father_name: string;
  mother_maiden_name: string;
  guardian_name: string;
  guardian_relationship: string;
  guardian_contact: string;
  
  // School Data
  learning_modality: string;
  remarks: string;
  
  created_at?: string;
}

export type AttendanceStatus = '' | 'x' | 'T'; // Blank (Present), x (Absent), T (Tardy)

export interface AttendanceRecord {
  id?: string;
  student_id: string;
  month_key: string; // YYYY-MM
  attendance_data: Record<string, AttendanceStatus>; // Key is day number ("1", "2")
  remarks?: string; // Additional remarks for SF2 (Dropped, Transferred, etc.)
}

export interface BookAssignment {
  id?: string;
  student_id: string;
  book_title: string;
  subject: string;
  date_issued: string;
  date_returned?: string;
  remarks?: string; // Lost, Unreturned, Damaged
}

export interface AcademicRecord {
  id?: string;
  student_id: string;
  general_average: number | '';
  action_taken: 'Promoted' | 'Conditional' | 'Retained' | '';
  incomplete_subjects: string;
}

// --- SF9 Data Types ---

export interface SubjectGrade {
  id?: string;
  student_id: string;
  subject: string;
  quarter_1: number | '';
  quarter_2: number | '';
  quarter_3: number | '';
  quarter_4: number | '';
  final_grade: number | '';
  remarks: string;
}

export interface LearnerValue {
  id?: string;
  student_id: string;
  core_value: string;
  behavior_statement: string;
  q1: string; // AO, SO, RO, NO
  q2: string;
  q3: string;
  q4: string;
}

export const CORE_VALUES_DATA = [
  {
    area: 'Maka-Diyos',
    statements: [
      'Expresses one\'s spiritual beliefs while respecting the spiritual beliefs of others.',
      'Shows adherence to ethical acts.'
    ]
  },
  {
    area: 'Makatao',
    statements: [
      'Is sensitive to individual, social, and cultural differences.',
      'Demonstrates contributions toward solidarity.'
    ]
  },
  {
    area: 'Makakalikasan',
    statements: [
      'Cares for the environment and utilizes resources wisely, judiciously, and economically.'
    ]
  },
  {
    area: 'Makabansa',
    statements: [
      'Demonstrates pride in being a Filipino; exercises the rights and responsibilities of a Filipino citizen.',
      'Demonstrates appropriate behavior in carrying out activities in the school, community, and country.'
    ]
  }
];

// --- Admin & Head Teacher Types ---

export interface Section {
  id?: string;
  grade_level: string;
  section_name: string;
  adviser_id?: string;
  created_at?: string;
  // Joins
  adviser?: {
    first_name: string;
    last_name: string;
  };
}

export interface SectionAssignment {
  id?: string;
  section_id: string;
  teacher_id: string;
  subject: string;
  created_at?: string;
  // Joins
  sections?: Section; 
  teachers?: {
    first_name: string;
    last_name: string;
  };
}

export interface SimpleTeacherProfile {
  id: string;
  first_name: string;
  last_name: string;
  main_subject: string;
  main_grade_level?: string;
  additional_grades?: string[];
}

// --- Class Record Types ---

export interface ClassRecordMeta {
  id?: string;
  grade_level: string;
  section: string;
  subject: string;
  quarter: number;
  hps_ww: Record<string, number>; // "1": 20
  hps_pt: Record<string, number>;
  hps_qa: Record<string, number>;
  // Custom Weights (in percentage, e.g., 20, 60, 20)
  weight_ww?: number;
  weight_pt?: number;
  weight_qa?: number;
}

export interface ClassRecordScore {
  id?: string;
  student_id: string;
  subject: string;
  quarter: number;
  scores_ww: Record<string, number>;
  scores_pt: Record<string, number>;
  scores_qa: Record<string, number>;
  initial_grade: number;
  quarterly_grade: number;
}

// DepEd K-12 Transmutation Table (Match Specific Request)
export const transmuteGrade = (initialGrade: number): number => {
  if (!initialGrade && initialGrade !== 0) return 0; // Handle null/undefined/NaN
  
  if (initialGrade === 100) return 100;
  if (initialGrade >= 98.40) return 99;
  if (initialGrade >= 96.80) return 98;
  if (initialGrade >= 95.20) return 97;
  if (initialGrade >= 93.60) return 96;
  if (initialGrade >= 92.00) return 95;
  if (initialGrade >= 90.40) return 94;
  if (initialGrade >= 88.80) return 93;
  if (initialGrade >= 87.20) return 92;
  if (initialGrade >= 85.60) return 91;
  if (initialGrade >= 84.00) return 90;
  if (initialGrade >= 82.40) return 89;
  if (initialGrade >= 80.80) return 88;
  if (initialGrade >= 79.20) return 87;
  if (initialGrade >= 77.60) return 86;
  if (initialGrade >= 76.00) return 85;
  if (initialGrade >= 74.40) return 84;
  if (initialGrade >= 72.80) return 83;
  if (initialGrade >= 71.20) return 82;
  if (initialGrade >= 69.60) return 81;
  if (initialGrade >= 68.00) return 80;
  if (initialGrade >= 66.40) return 79;
  if (initialGrade >= 64.80) return 78;
  if (initialGrade >= 63.20) return 77;
  if (initialGrade >= 61.60) return 76;
  if (initialGrade >= 60.00) return 75;
  // Floor Logic for ranges below 60
  if (initialGrade >= 56.00) return 74;
  if (initialGrade >= 52.00) return 73;
  if (initialGrade >= 48.00) return 72;
  if (initialGrade >= 44.00) return 71;
  if (initialGrade >= 40.00) return 70;
  if (initialGrade >= 36.00) return 69;
  if (initialGrade >= 32.00) return 68;
  if (initialGrade >= 28.00) return 67;
  if (initialGrade >= 24.00) return 66;
  if (initialGrade >= 20.00) return 65;
  if (initialGrade >= 16.00) return 64;
  if (initialGrade >= 12.00) return 63;
  if (initialGrade >= 8.00) return 62;
  if (initialGrade >= 4.00) return 61;
  if (initialGrade >= 0) return 60;
  
  return 60; // Default floor
};
