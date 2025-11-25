import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from './ui/Button';
import { 
  Users, BookOpen, Save, Download, Search, Menu, 
  FileSpreadsheet, Upload, Plus, X, Calendar, AlertCircle, Copy, RefreshCw, Library, Trash2,
  BarChart, PieChart, GraduationCap, Printer, Briefcase, LayoutGrid, Calculator, Edit2, Check, Clock, Settings, UserCheck, Pencil,
  ShieldCheck, LayoutDashboard, LogOut, ChevronDown, User, CheckSquare, Square, Key, Mail, Lock
} from 'lucide-react';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { 
  Role, Student, AttendanceRecord, AttendanceStatus, BookAssignment, Subject, AcademicRecord, 
  SubjectGrade, LearnerValue, CORE_VALUES_DATA, GradeLevel, Section, SectionAssignment, SimpleTeacherProfile,
  ClassRecordMeta, ClassRecordScore, transmuteGrade
} from '../types';

interface TeacherDashboardProps {
  session: any;
}

// Local type for managing combined attendance state
type AttendanceState = {
  days: Record<string, AttendanceStatus>;
  remarks: string;
};

// Types for SF6 Aggregation
type Sf6Counts = {
  male: number;
  female: number;
  total: number;
};

type Sf6GradeLevelData = {
  promoted: Sf6Counts;
  conditional: Sf6Counts;
  retained: Sf6Counts;
  learningProgress: {
    didNotMeet: Sf6Counts;
    fairly: Sf6Counts;
    satisfactory: Sf6Counts;
    verySatisfactory: Sf6Counts;
    outstanding: Sf6Counts;
  };
};

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ session }) => {
  const { user } = session;
  const { user_metadata } = user;
  
  // Extract teacher info with safeguards
  const teacherName = `${user_metadata.firstName || ''} ${user_metadata.lastName || ''}`;
  
  // Derived Roles
  const isHeadTeacher = user_metadata.role === Role.HEAD_TEACHER;
  const isAdmin = user_metadata.role === Role.ADMIN;
  
  // View State - Initialize based on Role
  const [activeView, setActiveView] = useState<'grading' | 'sf1' | 'sf2' | 'sf3' | 'sf5' | 'sf6' | 'sf9' | 'admin_sections' | 'class_record'>(
     isAdmin ? 'admin_sections' : 'class_record'
  );
  const [activeGrade, setActiveGrade] = useState<string>(user_metadata.mainGradeLevel || '');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Adviser Status State
  const [adviserSection, setAdviserSection] = useState<Section | null>(null);
  const [checkingAdviser, setCheckingAdviser] = useState(true);
  
  // Header User Menu State
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  
  // Profile Settings Form
  const [userProfileForm, setUserProfileForm] = useState({
    firstName: user_metadata.firstName || '',
    lastName: user_metadata.lastName || '',
    email: user.email || '',
    mainSubject: user_metadata.mainSubject || '',
    mainGradeLevel: user_metadata.mainGradeLevel || '',
    hasMultipleGrades: user_metadata.hasMultipleGrades || false,
    additionalGrades: (user_metadata.additionalGrades || []) as string[],
    additionalSubjects: (user_metadata.additionalSubjects || []) as string[]
  });
  
  // Derived Adviser Status
  const isAdviser = !!adviserSection; 

  // Tool Visibility Logic
  const showTeachingTools = !isAdmin; // Teachers, Advisers, Head Teachers see Class Record. Admin does NOT.
  const showAdviserTools = isAdviser; // Only explicit Advisers see School Forms.
  const showAdminTools = isAdmin || isHeadTeacher; // Admins and Head Teachers see Admin Tools.

  // Redirect if current view is not allowed
  useEffect(() => {
     if (isAdmin && activeView === 'class_record') {
        setActiveView('admin_sections');
     }
  }, [isAdmin, activeView]);

  // Data State
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);

  // SF1 Modal State
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [newStudent, setNewStudent] = useState<Partial<Student>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SF2 Attendance State
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceState>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  // SF3 Books State
  const [bookAssignments, setBookAssignments] = useState<Record<string, BookAssignment[]>>({});
  const [sf3Error, setSf3Error] = useState<string | null>(null);
  const [selectedStudentForBooks, setSelectedStudentForBooks] = useState<Student | null>(null);
  const [newBook, setNewBook] = useState<Partial<BookAssignment>>({
    book_title: '',
    subject: '',
    date_issued: new Date().toISOString().split('T')[0]
  });

  // SF5 Academic Records State
  const [academicRecords, setAcademicRecords] = useState<Record<string, AcademicRecord>>({});
  const [sf5Error, setSf5Error] = useState<string | null>(null);
  const [savingSf5, setSavingSf5] = useState(false);

  // SF9 State
  const [sf9Student, setSf9Student] = useState<Student | null>(null);
  const [sf9Grades, setSf9Grades] = useState<SubjectGrade[]>([]);
  const [sf9Values, setSf9Values] = useState<LearnerValue[]>([]);
  const [sf9Attendance, setSf9Attendance] = useState<Record<string, { present: number, absent: number, tardy: number }>>({});
  const [sf9Error, setSf9Error] = useState<string | null>(null);

  // Admin & Head Teacher State
  const [adminTab, setAdminTab] = useState<'sections' | 'assignments' | 'users'>('sections');
  const [allSections, setAllSections] = useState<Section[]>([]);
  const [allTeachers, setAllTeachers] = useState<SimpleTeacherProfile[]>([]);
  
  // Admin - Manage Sections
  const [newSection, setNewSection] = useState({ grade_level: '', section_name: '' });
  const [isEditingSection, setIsEditingSection] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  
  // Admin - Assign Teachers
  const [selectedSectionForAssign, setSelectedSectionForAssign] = useState<string>('');
  const [currentAssignments, setCurrentAssignments] = useState<Record<string, string>>({}); // Subject -> TeacherID
  
  // CLASS RECORD State
  const [mySections, setMySections] = useState<Section[]>([]);
  const [mySubjectAssignments, setMySubjectAssignments] = useState<{section_id: string, subject: string}[]>([]); // Store subject assignments
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]); // Filtered subjects for dropdown
  const [crSelection, setCrSelection] = useState({ grade: '', section: '', subject: '', quarter: 1 });
  const [crMeta, setCrMeta] = useState<ClassRecordMeta | null>(null);
  const [crScores, setCrScores] = useState<Record<string, ClassRecordScore>>({}); 
  const [crError, setCrError] = useState<string | null>(null);
  
  // Helper to extract error message safely
  const getErrorMessage = (error: any): string => {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    return JSON.stringify(error);
  };

  // Helper for SF2 Weekend Calculation
  const getDayStatus = (day: number) => {
    if (!selectedMonth) return { isWeekend: false, isInvalid: false };
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr); 
    const date = new Date(year, month - 1, day);
    const isInvalid = date.getMonth() !== (month - 1);
    const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    return { isWeekend, isInvalid };
  };

  // Helper to safely get teacher name regardless of case (snake vs camel)
  const getTeacherName = (t: any) => {
    if (!t) return 'Unknown';
    const first = t.first_name || t.firstName || '';
    const last = t.last_name || t.lastName || '';
    return `${last}, ${first}`;
  };

  // --- Initial Checks & Syncing ---
  
  // Self-Healing: Sync Profile to 'profiles' table if it doesn't exist
  // This ensures that existing users appear in the Admin lists
  const syncUserProfile = async () => {
    try {
      // Check if I exist in profiles
      const { data } = await supabase.from('profiles').select('id, additional_subjects').eq('id', user.id).maybeSingle();
      
      if (!data) {
         console.log("Profile missing, syncing now...");
         await supabase.from('profiles').insert([{
           id: user.id,
           first_name: user_metadata.firstName,
           last_name: user_metadata.lastName,
           email: user.email,
           username: user_metadata.username,
           role: user_metadata.role,
           main_subject: user_metadata.mainSubject,
           main_grade_level: user_metadata.mainGradeLevel,
           has_multiple_grades: user_metadata.hasMultipleGrades,
           additional_grades: user_metadata.additionalGrades || [],
           additional_subjects: user_metadata.additionalSubjects || []
         }]);
      } else {
         // If I exist, ensure local state matches DB (especially for arrays)
         setUserProfileForm(prev => ({
            ...prev,
            additionalSubjects: data.additional_subjects || []
         }));
      }
    } catch (e) {
      console.error("Error syncing profile:", e);
    }
  };

  const checkAdviserStatus = async () => {
    setCheckingAdviser(true);
    try {
      const { data, error } = await supabase.from('sections').select('*').eq('adviser_id', user.id).maybeSingle();
      if (data) {
        setAdviserSection(data);
        setActiveGrade(data.grade_level);
        if(!crSelection.section) {
           setCrSelection(prev => ({...prev, grade: data.grade_level, section: data.section_name}));
        }
      } else {
        setAdviserSection(null);
      }
    } catch (e) {
      console.error("Error checking adviser status:", e);
    } finally {
      setCheckingAdviser(false);
    }
  };

  const fetchMySections = async () => {
    try {
      // 1. Get sections where I am the adviser
      const { data: adviserData } = await supabase.from('sections').select('*').eq('adviser_id', user.id);
      
      // 2. Get sections where I am a subject teacher (and fetch the subject!)
      const { data: assignmentData } = await supabase.from('section_assignments')
        .select('subject, section_id, sections(id, grade_level, section_name)') // Join to get section details
        .eq('teacher_id', user.id);
        
      const sectionsFromAssignments = assignmentData?.map((a:any) => a.sections) || [];
      const sectionsFromAdviser = adviserData || [];
      
      // Store specific subject assignments
      const subjectAssignments = assignmentData?.map((a:any) => ({
        section_id: a.section_id,
        subject: a.subject
      })) || [];
      setMySubjectAssignments(subjectAssignments);

      // Merge and dedup based on ID for the Section Dropdown
      const all = [...sectionsFromAdviser, ...sectionsFromAssignments].filter(Boolean);
      const uniqueMap = new Map();
      all.forEach(s => uniqueMap.set(s.id, s));
      const unique = Array.from(uniqueMap.values());
      
      setMySections(unique);
      
      // If no CR selection yet, pick first
      if (!crSelection.section && unique.length > 0) {
         setCrSelection(prev => ({...prev, grade: unique[0].grade_level, section: unique[0].section_name}));
      }
    } catch (e) {
      console.error("Error fetching my sections", e);
    }
  };

  useEffect(() => {
    syncUserProfile();
    checkAdviserStatus();
    fetchMySections();
  }, [user.id]);
  
  // Effect to filter Available Subjects based on Selected Section
  useEffect(() => {
    if (!crSelection.section || !crSelection.grade) {
      setAvailableSubjects([]);
      return;
    }

    // 1. Find the section object for the current selection to get its ID
    const currentSectionObj = mySections.find(s => 
      s.section_name === crSelection.section && s.grade_level === crSelection.grade
    );

    if (!currentSectionObj) {
       setAvailableSubjects([]);
       return;
    }

    const currentSectionId = currentSectionObj.id;

    // 2. Get explicit assignments for this section
    const assignedSubjects = mySubjectAssignments
      .filter(a => a.section_id === currentSectionId)
      .map(a => a.subject);

    // 3. If I am the ADVISER, I should also be able to see my Main Subject (from registration)
    //    or simply assume Advisers can teach their main subject to their own section.
    if (adviserSection && adviserSection.id === currentSectionId && user_metadata.mainSubject) {
      if (!assignedSubjects.includes(user_metadata.mainSubject)) {
        assignedSubjects.push(user_metadata.mainSubject);
      }
    }

    // 4. Set available subjects
    const uniqueSubjects = [...new Set(assignedSubjects)];
    setAvailableSubjects(uniqueSubjects);

    // 5. Auto-select logic
    // If the currently selected subject is NOT in the allowed list, default to the first one
    if (uniqueSubjects.length > 0) {
       if (!crSelection.subject || !uniqueSubjects.includes(crSelection.subject)) {
          setCrSelection(prev => ({ ...prev, subject: uniqueSubjects[0] }));
       }
    } else {
       // No subjects allowed? Clear selection
       setCrSelection(prev => ({ ...prev, subject: '' }));
    }

  }, [crSelection.section, crSelection.grade, mySections, mySubjectAssignments, adviserSection, user_metadata.mainSubject]);

  // --- Data Fetching ---
  const fetchStudents = async () => {
    let gradeToFetch = activeGrade;
    let sectionToFetch = '';

    if (['sf1', 'sf2', 'sf3', 'sf5', 'sf6', 'sf9'].includes(activeView)) {
      if (adviserSection) {
        gradeToFetch = adviserSection.grade_level;
        sectionToFetch = adviserSection.section_name;
      } else if (!isAdmin) {
         setStudents([]);
         return;
      }
    } else if (activeView === 'class_record' && crSelection.grade) {
      gradeToFetch = crSelection.grade;
      sectionToFetch = crSelection.section;
    }

    if (!gradeToFetch) return;
    if (activeView === 'admin_sections') return; 

    setLoading(true);
    try {
      let query = supabase.from('students').select('*').eq('grade_level', gradeToFetch);
      if (sectionToFetch) {
        query = query.eq('section', sectionToFetch);
      }

      query = query.order('sex', { ascending: false }).order('last_name', { ascending: true });
      const { data, error } = await query;

      if (error) throw error;
      const fetchedStudents = data || [];
      setStudents(fetchedStudents);
      
      if (activeView === 'sf2') await fetchAttendance();
      else if (activeView === 'sf3') await fetchBooks(fetchedStudents);
      else if (activeView === 'sf5' || activeView === 'sf6') await fetchAcademicRecords(fetchedStudents);
      else if (activeView === 'sf9') await fetchAllAttendanceForSummary(fetchedStudents);
      else if (activeView === 'class_record') await fetchClassRecord(fetchedStudents);

    } catch (err: any) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClassRecord = async (currentStudents: Student[]) => {
    setCrError(null); setCrMeta(null); setCrScores({});
    try {
      if (!crSelection.grade || !crSelection.section || !crSelection.subject) return;

      const { data: metaData, error: metaError } = await supabase
        .from('class_record_meta')
        .select('*')
        .eq('grade_level', crSelection.grade)
        .eq('section', crSelection.section)
        .eq('subject', crSelection.subject)
        .eq('quarter', crSelection.quarter)
        .maybeSingle();

      if (metaError && !metaError.message.includes('No rows found')) throw metaError;
      
      if (metaData) {
        setCrMeta(metaData);
      } else {
        setCrMeta({
          grade_level: crSelection.grade, section: crSelection.section, subject: crSelection.subject, quarter: crSelection.quarter,
          hps_ww: {}, hps_pt: {}, hps_qa: {},
          weight_ww: 30, weight_pt: 50, weight_qa: 20
        });
      }

      if (currentStudents.length === 0) return;
      const studentIds = currentStudents.map(s => s.id);
      const { data: scoresData, error: scoresError } = await supabase
        .from('class_record_scores')
        .select('*')
        .in('student_id', studentIds)
        .eq('subject', crSelection.subject)
        .eq('quarter', crSelection.quarter);

      if (scoresError) throw scoresError;

      const scoreMap: Record<string, ClassRecordScore> = {};
      scoresData?.forEach((sc: ClassRecordScore) => { scoreMap[sc.student_id] = sc; });
      setCrScores(scoreMap);

    } catch (err: any) {
      const msg = getErrorMessage(err);
      if (msg.includes('relation "class_record_meta" does not exist')) setCrError('MISSING_TABLE');
      else setCrError(msg);
    }
  };

  const fetchAttendance = async () => {
    setAttendanceError(null);
    try {
      const { data, error } = await supabase.from('attendance_records').select('*').eq('month_key', selectedMonth);
      if (error) throw error;
      const recordMap: Record<string, AttendanceState> = {};
      const records = (data || []) as unknown as AttendanceRecord[];
      records.forEach((rec) => { 
        recordMap[rec.student_id] = { days: rec.attendance_data || {}, remarks: rec.remarks || '' }; 
      });
      setAttendanceRecords(recordMap);
    } catch (err: any) {
      const msg = getErrorMessage(err);
      if (msg.includes('attendance_records') || msg.includes('does not exist') || msg.includes('42P01')) setAttendanceError('MISSING_TABLE');
      else setAttendanceError(msg);
    }
  };

  const fetchBooks = async (currentStudents: Student[]) => {
    setSf3Error(null);
    if (currentStudents.length === 0) { setBookAssignments({}); return; }
    try {
      const studentIds = currentStudents.map(s => s.id);
      const { data, error } = await supabase.from('book_assignments').select('*').in('student_id', studentIds);
      if (error) throw error;
      const bookMap: Record<string, BookAssignment[]> = {};
      data?.forEach((book: BookAssignment) => { if (!bookMap[book.student_id]) bookMap[book.student_id] = []; bookMap[book.student_id].push(book); });
      setBookAssignments(bookMap);
    } catch (err: any) {
      const msg = getErrorMessage(err);
      if (msg.includes('book_assignments') || msg.includes('does not exist') || msg.includes('42P01')) setSf3Error('MISSING_TABLE');
      else setSf3Error(msg);
    }
  };

  const fetchAcademicRecords = async (currentStudents: Student[]) => {
    setSf5Error(null);
    if (currentStudents.length === 0) { setAcademicRecords({}); return; }
    try {
      const studentIds = currentStudents.map(s => s.id);
      const { data, error } = await supabase.from('student_academic_records').select('*').in('student_id', studentIds);
      if (error) throw error;
      const recordMap: Record<string, AcademicRecord> = {};
      data?.forEach((rec: AcademicRecord) => { recordMap[rec.student_id] = rec; });
      setAcademicRecords(recordMap);
    } catch (err: any) {
      const msg = getErrorMessage(err);
      if (msg.includes('student_academic_records') || msg.includes('does not exist') || msg.includes('42P01')) setSf5Error('MISSING_TABLE');
      else setSf5Error(msg);
    }
  };

  const fetchAllAttendanceForSummary = async (currentStudents: Student[]) => {
    if (currentStudents.length === 0) return;
    try {
      const studentIds = currentStudents.map(s => s.id);
      await supabase.from('attendance_records').select('*').in('student_id', studentIds);
    } catch (e) { console.log("SF9 Attendance Fetch Error (Non-blocking):", e); }
  };

  const fetchSF9Details = async (studentId: string) => {
    setSf9Error(null); setLoading(true);
    try {
      // 1. Grades
      const { data: gradesData, error: gradesError } = await supabase.from('subject_grades').select('*').eq('student_id', studentId);
      if (gradesError) { if (gradesError.message.includes('does not exist')) setSf9Error('MISSING_GRADES_TABLE'); else throw gradesError; }
      
      const subjects = Object.values(Subject);
      const initializedGrades: SubjectGrade[] = subjects.map(sub => {
        const existing = gradesData?.find((g: SubjectGrade) => g.subject === sub);
        return existing || { student_id: studentId, subject: sub, quarter_1: '', quarter_2: '', quarter_3: '', quarter_4: '', final_grade: '', remarks: '' };
      });
      setSf9Grades(initializedGrades);

      // 2. Values
      const { data: valuesData, error: valuesError } = await supabase.from('learner_values').select('*').eq('student_id', studentId);
      if (valuesError) { if (valuesError.message.includes('does not exist')) setSf9Error('MISSING_VALUES_TABLE'); else throw valuesError; }
      
      const initializedValues: LearnerValue[] = [];
      CORE_VALUES_DATA.forEach(core => {
        core.statements.forEach(stmt => {
          const existing = valuesData?.find((v: LearnerValue) => v.behavior_statement === stmt);
          initializedValues.push(existing || { student_id: studentId, core_value: core.area, behavior_statement: stmt, q1: '', q2: '', q3: '', q4: '' });
        });
      });
      setSf9Values(initializedValues);

      // 3. Attendance Summary
      const { data: attData } = await supabase.from('attendance_records').select('*').eq('student_id', studentId);
      const attSummary: Record<string, { present: number, absent: number, tardy: number }> = {};
      
      // Default buckets for 12 months
      for(let i=1; i<=12; i++) {
        attSummary[String(i).padStart(2,'0')] = { present: 0, absent: 0, tardy: 0 };
      }

      attData?.forEach((rec: AttendanceRecord) => {
         const monthNum = rec.month_key.split('-')[1]; 
         const days = rec.attendance_data || {}; 
         const values = Object.values(days);
         const absent = values.filter(v => v === 'x').length; 
         const tardy = values.filter(v => v === 'T').length;
         // Assume 20 school days as base if not calculated precisely
         attSummary[monthNum] = { present: 20 - absent, absent, tardy };
      });
      setSf9Attendance(attSummary);

    } catch (err: any) { 
      if (!sf9Error) setSf9Error(getErrorMessage(err)); 
    } finally { 
      setLoading(false); 
    }
  };

  const fetchAdminData = async () => {
    if (!isAdmin && !isHeadTeacher) return;
    setLoading(true);
    try {
      // 1. Fetch Sections 
      const { data: secData, error: secError } = await supabase.from('sections').select('*').order('grade_level');
      if (secError) throw secError;
      setAllSections(secData || []);

      // 2. Fetch Profiles with extended info
      const { data: profData, error: profError } = await supabase
         .from('profiles')
         .select('*')
         .order('last_name'); // Order by name for easier lookup
      
      if (profError) {
         console.warn("Could not fetch profiles", profError);
         setAllTeachers([]); 
      } else {
         setAllTeachers(profData as any[]);
      }
    } catch (e: any) {
      console.error("Admin Fetch Error", e);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchSectionAssignments = async (sectionId: string) => {
     if(!sectionId) return;
     setLoading(true);
     try {
       const { data, error } = await supabase.from('section_assignments')
          .select('subject, teacher_id')
          .eq('section_id', sectionId);
          
       if(error) throw error;
       
       const assignmentMap: Record<string, string> = {};
       data?.forEach((item: any) => {
          assignmentMap[item.subject] = item.teacher_id;
       });
       setCurrentAssignments(assignmentMap);
     } catch(e:any) {
       console.error("Fetch Assignments Error", e);
     } finally {
       setLoading(false);
     }
  };

  useEffect(() => {
    if (checkingAdviser) return;
    if (activeView === 'admin_sections') {
      fetchAdminData();
    } else {
      fetchStudents();
    }
  }, [activeGrade, activeView, selectedMonth, crSelection, checkingAdviser, adviserSection]);
  
  useEffect(() => {
     if(activeView === 'admin_sections' && selectedSectionForAssign) {
        fetchSectionAssignments(selectedSectionForAssign);
     }
  }, [selectedSectionForAssign]);

  useEffect(() => { 
    if (activeView === 'sf9' && sf9Student) {
      fetchSF9Details(sf9Student.id!); 
    }
  }, [sf9Student]);

  // --- Handlers ---
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleUpdateMyProfile = async (e: React.FormEvent) => {
     e.preventDefault();
     setLoading(true);
     try {
        const { error } = await supabase.from('profiles').update({
           first_name: userProfileForm.firstName,
           last_name: userProfileForm.lastName,
           main_grade_level: userProfileForm.mainGradeLevel,
           has_multiple_grades: userProfileForm.hasMultipleGrades,
           additional_grades: userProfileForm.additionalGrades,
           additional_subjects: userProfileForm.additionalSubjects
        }).eq('id', user.id);
        
        if(error) throw error;
        
        if (userProfileForm.email !== user.email) {
           const { error: authError } = await supabase.auth.updateUser({ email: userProfileForm.email });
           if(authError) alert("Profile updated, but failed to update Login Email: " + authError.message);
           else alert("Profile and Login Email updated! Check your new email for confirmation.");
        } else {
           alert("Profile Updated Successfully.");
        }
        setShowProfileSettings(false);
     } catch(e:any) {
        alert("Error updating profile: " + e.message);
     } finally {
        setLoading(false);
     }
  };

  const handleResetPassword = async (email: string) => {
     if (!email) return alert("No email address found for this user.");
     if (!confirm(`Send password reset email to ${email}?`)) return;
     
     setLoading(true);
     try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
           redirectTo: window.location.origin
        });
        if (error) throw error;
        alert(`Password reset email sent to ${email}`);
     } catch(e:any) {
        alert("Error sending reset email: " + e.message);
     } finally {
        setLoading(false);
     }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewStudent(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    if (!adviserSection && !isAdmin) { alert("Error: You must be an assigned Class Adviser."); setLoading(false); return; }
    try {
      const targetGrade = adviserSection ? adviserSection.grade_level : newStudent.grade_level;
      const targetSection = adviserSection ? adviserSection.section_name : newStudent.section;
      const studentPayload = { ...newStudent, grade_level: targetGrade, section: targetSection };
      let error;
      if (isEditingStudent && newStudent.id) {
         const { error: updateError } = await supabase.from('students').update(studentPayload).eq('id', newStudent.id);
         error = updateError;
      } else {
         const { error: insertError } = await supabase.from('students').insert([studentPayload]);
         error = insertError;
      }
      if (error) throw error;
      alert(isEditingStudent ? 'Student updated!' : 'Student added!'); 
      setShowAddStudentModal(false); setNewStudent({}); setIsEditingStudent(false); await fetchStudents();
    } catch (error: any) { alert('Error: ' + getErrorMessage(error)); } finally { setLoading(false); }
  };

  const handleEditStudent = (student: Student) => { setNewStudent(student); setIsEditingStudent(true); setShowAddStudentModal(true); };
  const handleDeleteStudent = async (id: string) => {
    if(!id || !confirm("Delete student?")) return;
    setLoading(true);
    try { const { error } = await supabase.from('students').delete().eq('id', id); if(error) throw error; await fetchStudents(); } catch(err:any) { alert("Error: "+getErrorMessage(err)); } finally { setLoading(false); }
  };

  const handleDownloadTemplate = () => {
    const headers = ["lrn", "last_name", "first_name", "middle_name", "extension_name", "sex", "birth_date", "age", "birth_place", "religion", "address_house_no", "address_barangay", "address_municipality", "address_province", "address_zip", "father_name", "mother_maiden_name", "guardian_name", "guardian_relationship", "guardian_contact", "learning_modality", "remarks"];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n123456789012,Doe,John,,,M,2010-01-01,14,Manila,Catholic,123,Barangay,City,Province,1000,Father,Mother,Guardian,Father,09123456789,F2F,";
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", "SF1_Template.csv"); document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!adviserSection && !isAdmin) { alert("Error: Adviser only."); if(fileInputRef.current) fileInputRef.current.value=''; return; }
    const reader = new FileReader();
    reader.onload = async (evt) => {
      let text = evt.target?.result as string; if (!text) return;
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      const parseCSV = (input: string) => {
        const rows: string[][] = []; let currentRow: string[] = []; let currentVal = ''; let inQuotes = false;
        for (let i = 0; i < input.length; i++) {
          const char = input[i]; const nextChar = input[i + 1];
          if (char === '"') { if (inQuotes && nextChar === '"') { currentVal += '"'; i++; } else { inQuotes = !inQuotes; } } 
          else if ((char === ',' || char === ';') && !inQuotes) { currentRow.push(currentVal.trim()); currentVal = ''; } 
          else if ((char === '\r' || char === '\n') && !inQuotes) { if (currentRow.length > 0 || currentVal) { currentRow.push(currentVal.trim()); rows.push(currentRow); } currentRow = []; currentVal = ''; if (char === '\r' && nextChar === '\n') i++; } 
          else { currentVal += char; }
        }
        if (currentRow.length > 0 || currentVal) { currentRow.push(currentVal.trim()); rows.push(currentRow); }
        return rows;
      };
      const rows = parseCSV(text);
      if (rows.length < 2) { alert("Empty CSV."); return; }
      
      const studentsToAdd: any[] = [];
      for(let i=1; i<rows.length; i++){
         const vals = rows[i];
         if(vals.length < 3) continue;
         // Basic Mapping
         studentsToAdd.push({
             lrn: vals[0], last_name: vals[1], first_name: vals[2], middle_name: vals[3], sex: vals[5]||'M', birth_date: vals[6],
             grade_level: adviserSection?.grade_level, section: adviserSection?.section_name
         });
      }
      
      if(studentsToAdd.length > 0) {
          const { error } = await supabase.from('students').insert(studentsToAdd);
          if(error) alert("Error: "+error.message); else { alert("Uploaded!"); await fetchStudents(); }
      }
    };
    reader.readAsText(file);
  };

  const handleAttendanceToggle = (studentId: string, day: string) => {
    setAttendanceRecords((prev: Record<string, AttendanceState>) => {
      const current: AttendanceState = prev[studentId] || { days: {}, remarks: '' };
      const status = current.days[day];
      const nextStatus: AttendanceStatus = status === undefined ? 'x' : status === 'x' ? 'T' : status === 'T' ? '' : 'x';
      const newDays = { ...current.days };
      if (nextStatus === '') delete newDays[day]; else newDays[day] = nextStatus;
      return { ...prev, [studentId]: { ...current, days: newDays } };
    });
  };

  const handleAttendanceRemarkChange = (id: string, val: string) => 
    setAttendanceRecords((p: Record<string, AttendanceState>) => {
       const current: AttendanceState = p[id] || { days: {}, remarks: '' };
       return { ...p, [id]: { ...current, remarks: val } };
    });

  const saveAttendance = async () => {
    setSavingAttendance(true);
    try {
      const upserts = Object.entries(attendanceRecords).map(([sid, d]) => {
         const record = d as AttendanceState;
         return { 
            student_id: sid, 
            month_key: selectedMonth, 
            attendance_data: record.days, 
            remarks: record.remarks 
         };
      });
      if(upserts.length) await supabase.from('attendance_records').upsert(upserts, { onConflict: 'student_id, month_key' });
      alert("Saved!");
    } catch(e:any) { alert(e.message); } finally { setSavingAttendance(false); }
  };

  const handleSaveBook = async () => { if(!selectedStudentForBooks) return; setLoading(true); try{ await supabase.from('book_assignments').insert([{...newBook, student_id:selectedStudentForBooks.id}]); await fetchBooks([selectedStudentForBooks]); alert("Book assigned!"); }catch(e:any){alert(e.message);}finally{setLoading(false);} };
  const handleReturnBook = async (id: string) => { try{ await supabase.from('book_assignments').update({date_returned:new Date().toISOString()}).eq('id',id); if(selectedStudentForBooks) fetchBooks([selectedStudentForBooks]); }catch(e){console.error(e);} };
  
  // SF5 Logic
  const handleAcademicRecordChange = (sid: string, field: keyof AcademicRecord, value: any) => {
    setAcademicRecords(prev => ({
      ...prev,
      [sid]: { ...prev[sid] || { student_id: sid, general_average: '', action_taken: '', incomplete_subjects: '' }, [field]: value }
    }));
  };
  const saveSf5Data = async () => {
    setSavingSf5(true);
    try {
      const upserts = Object.values(academicRecords).map((r: AcademicRecord) => ({...r, student_id: r.student_id}));
      if(upserts.length > 0) {
        const { error } = await supabase.from('student_academic_records').upsert(upserts, { onConflict: 'student_id' });
        if(error) throw error;
        alert("Academic Records Saved!");
      }
    } catch(e:any) { alert("Error: " + getErrorMessage(e)); } finally { setSavingSf5(false); }
  };

  // SF9 Logic
  const handleSf9GradeChange = (index: number, field: keyof SubjectGrade, value: string) => {
    setSf9Grades(prev => {
      const updated = [...prev];
      (updated[index] as any)[field] = value; 
      return updated;
    });
  };
  const handleSf9ValueChange = (index: number, q: string, value: string) => {
    setSf9Values(prev => {
      const updated = [...prev];
      (updated[index] as any)[q] = value;
      return updated;
    });
  };

  const saveSf9Data = async () => {
    if (!sf9Student) return;
    setLoading(true);
    try {
      // Save Grades
      const payloadGrades = sf9Grades.map(g => ({
        student_id: sf9Student.id, subject: g.subject,
        quarter_1: g.quarter_1, quarter_2: g.quarter_2, quarter_3: g.quarter_3, quarter_4: g.quarter_4,
        final_grade: g.final_grade, remarks: g.remarks
      }));
      await supabase.from('subject_grades').upsert(payloadGrades, { onConflict: 'student_id, subject' });
      
      // Save Values
      const payloadValues = sf9Values.map(v => ({
        student_id: sf9Student.id, behavior_statement: v.behavior_statement,
        core_value: v.core_value, q1: v.q1, q2: v.q2, q3: v.q3, q4: v.q4
      }));
      await supabase.from('learner_values').upsert(payloadValues, { onConflict: 'student_id, behavior_statement' });

      alert("Grades & Values Saved!");
    } catch(e: any) {
      alert("Error saving: " + getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  // --- ADMIN HANDLERS ---
  const handleAddSection = async () => {
    if(!newSection.grade_level || !newSection.section_name) return alert("Fill in details");
    setLoading(true);
    try {
      if(isEditingSection && editingSectionId) {
         const { error } = await supabase.from('sections').update(newSection).eq('id', editingSectionId);
         if(error) throw error;
         alert("Section Updated");
         setIsEditingSection(false); setEditingSectionId(null);
      } else {
         const { error } = await supabase.from('sections').insert([newSection]);
         if(error) throw error;
         alert("Section Added");
      }
      setNewSection({grade_level:'', section_name:''});
      fetchAdminData();
    } catch(e:any) { alert(e.message); } finally { setLoading(false); }
  };

  const handleAssignAdviser = async (sectionId: string, teacherId: string) => {
     setLoading(true);
     try {
       const { error } = await supabase.from('sections').update({ adviser_id: teacherId || null }).eq('id', sectionId);
       if(error) throw error;
       fetchAdminData();
     } catch(e:any) { alert(e.message); } finally { setLoading(false); }
  };
  
  const handleStartEditSection = (sec: Section) => {
     setNewSection({ grade_level: sec.grade_level, section_name: sec.section_name });
     setEditingSectionId(sec.id!);
     setIsEditingSection(true);
  };
  
  const handleAssignSubjectTeacher = async (subject: string, teacherId: string) => {
     if(!selectedSectionForAssign) return alert("Select a section first.");
     setLoading(true);
     try {
        // Check if assignment exists
        const { data } = await supabase.from('section_assignments')
           .select('id')
           .eq('section_id', selectedSectionForAssign)
           .eq('subject', subject)
           .maybeSingle();
           
        if (data) {
           if (teacherId) {
              // Update
              await supabase.from('section_assignments').update({ teacher_id: teacherId }).eq('id', data.id);
           } else {
              // Remove
              await supabase.from('section_assignments').delete().eq('id', data.id);
           }
        } else if (teacherId) {
           // Insert
           await supabase.from('section_assignments').insert({
              section_id: selectedSectionForAssign,
              subject: subject,
              teacher_id: teacherId
           });
        }
        // Update local state
        setCurrentAssignments(prev => ({...prev, [subject]: teacherId}));
     } catch(e:any) {
        console.error(e);
        alert("Failed to assign teacher");
     } finally {
        setLoading(false);
     }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if(!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;
    setLoading(true);
    try {
       const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
       if(error) throw error;
       alert("User role updated successfully.");
       fetchAdminData();
    } catch(e: any) {
       alert("Error updating role: " + e.message);
    } finally {
       setLoading(false);
    }
  };

  const handleUpdateUserFields = async (userId: string, field: 'main_subject' | 'main_grade_level', value: string) => {
     setLoading(true);
     try {
        const { error } = await supabase.from('profiles').update({ [field]: value }).eq('id', userId);
        if(error) throw error;
        // Optimistic update
        setAllTeachers(prev => prev.map(t => t.id === userId ? { ...t, [field]: value } : t));
     } catch(e:any) {
        alert("Failed to update user: " + e.message);
     } finally {
        setLoading(false);
     }
  };

  // --- CLASS RECORD LOGIC ---
  const handleCrMetaChange = (field: keyof ClassRecordMeta, value: any) => {
    setCrMeta(prev => {
       if(!prev) return prev;
       return { ...prev, [field]: value };
    });
  };

  const handleHpsChange = (type: 'hps_ww' | 'hps_pt' | 'hps_qa', index: string, value: string) => {
    setCrMeta(prev => {
      if(!prev) return prev;
      const numVal = parseInt(value) || 0;
      return { ...prev, [type]: { ...prev[type], [index]: numVal } };
    });
  };

  const handleCrScoreChange = (sid: string, t: 'scores_ww' | 'scores_pt' | 'scores_qa', k: string, v: string) => {
     setCrScores(prev => {
        const cur = prev[sid] || { student_id: sid, subject: crSelection.subject, quarter: crSelection.quarter, scores_ww:{}, scores_pt:{}, scores_qa:{}, initial_grade:0, quarterly_grade:0 };
        return { ...prev, [sid]: { ...cur, [t]: { ...cur[t], [k]: parseInt(v)||0 } } };
     });
  };

  // Helper for arrow key navigation
  const handleKeyDown = (e: React.KeyboardEvent, sid: string, type: string, index: string) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
       e.preventDefault();
       // Structure: cell-{studentId}-{type}-{index}
       // We need to find the DOM element based on these coordinates
       const currentInput = e.currentTarget as HTMLInputElement;
       const currentRow = currentInput.closest('tr');
       const allRows = Array.from(document.querySelectorAll('tr[data-student-id]'));
       const rowIdx = allRows.indexOf(currentRow as any);
       
       let target: HTMLInputElement | null = null;

       if (e.key === 'ArrowUp' && rowIdx > 0) {
          const prevRow = allRows[rowIdx - 1];
          target = prevRow.querySelector(`input[data-col="${type}-${index}"]`) as HTMLInputElement;
       } else if (e.key === 'ArrowDown' && rowIdx < allRows.length - 1) {
          const nextRow = allRows[rowIdx + 1];
          target = nextRow.querySelector(`input[data-col="${type}-${index}"]`) as HTMLInputElement;
       } else if (e.key === 'ArrowLeft') {
          // Logic for previous sibling input is tricky due to different types, simple sibling nav for now
          const inputs = Array.from(currentRow?.querySelectorAll('input') || []);
          const idx = inputs.indexOf(currentInput);
          if(idx > 0) target = inputs[idx - 1] as HTMLInputElement;
       } else if (e.key === 'ArrowRight') {
          const inputs = Array.from(currentRow?.querySelectorAll('input') || []);
          const idx = inputs.indexOf(currentInput);
          if(idx < inputs.length - 1) target = inputs[idx + 1] as HTMLInputElement;
       }

       if (target) {
          target.focus();
          target.select();
       }
    }
  };

  // Paste handler for bulk data entry
  const handlePaste = (e: React.ClipboardEvent, startSid: string, startType: string, startIndex: number) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    const rows = pasteData.split(/\r\n|\n|\r/).filter(row => row.trim() !== '');
    
    // Find starting student index
    const studentIdx = students.findIndex(s => s.id === startSid);
    if(studentIdx === -1) return;

    // We only support pasting into same type for now (e.g. WW block) to keep it simple
    if(!['scores_ww', 'scores_pt', 'scores_qa'].includes(startType)) return;

    const newScores = { ...crScores };
    
    rows.forEach((rowVal, rIdx) => {
       const targetStudent = students[studentIdx + rIdx];
       if(!targetStudent) return;
       
       const cols = rowVal.split(/\t/);
       cols.forEach((val, cIdx) => {
          // Calculate target column index (e.g. 1 + 0 = 1)
          const targetCol = startIndex + cIdx;
          if(targetCol > 10 && startType !== 'scores_qa') return; // Limit to 10 cols
          if(targetCol > 1 && startType === 'scores_qa') return; // Limit QA to 1
          
          const sid = targetStudent.id!;
          if(!newScores[sid]) {
             newScores[sid] = { 
                student_id: sid, subject: crSelection.subject, quarter: crSelection.quarter, 
                scores_ww:{}, scores_pt:{}, scores_qa:{}, initial_grade:0, quarterly_grade:0 
             };
          }
          
          // Update the specific score
          newScores[sid] = {
             ...newScores[sid],
             [startType]: {
                ...newScores[sid][startType as keyof ClassRecordScore] as Record<string, number>,
                [String(targetCol)]: parseInt(val.trim()) || 0
             }
          };
       });
    });
    
    setCrScores(newScores);
  };

  const saveClassRecord = async () => { 
     setLoading(true);
     try {
        // 1. Save Meta
        if(crMeta) {
          const { error: metaError } = await supabase.from('class_record_meta').upsert({
             ...crMeta,
             grade_level: crSelection.grade,
             section: crSelection.section,
             subject: crSelection.subject,
             quarter: crSelection.quarter
          }, { onConflict: 'grade_level, section, subject, quarter' });
          if(metaError) throw metaError;
        }

        // 2. Save Scores
        const scorePayload = Object.values(crScores).map((sc: ClassRecordScore) => {
           // Ensure grades are calculated before save
           const computed = calculateGrade(sc, crMeta!);
           return {
              ...sc,
              initial_grade: computed.initialGrade,
              quarterly_grade: computed.quarterlyGrade
           };
        });

        if(scorePayload.length > 0) {
           const { error: scoreError } = await supabase.from('class_record_scores').upsert(scorePayload, { onConflict: 'student_id, subject, quarter' });
           if(scoreError) throw scoreError;
        }

        alert("Class Record Saved Successfully!");
     } catch(e:any) {
        alert("Error saving: " + getErrorMessage(e));
     } finally {
        setLoading(false);
     }
  };
  
  // Grade Calculation Logic
  const calculateGrade = (scoreRec: ClassRecordScore | undefined, meta: ClassRecordMeta) => {
    // Default zero object for safety
    const zero = { total:0, ws:0, ps:0 };
    const defaultRes = { 
        initialGrade: 0, 
        quarterlyGrade: 0, 
        ww: zero, pt: zero, qa: zero 
    };

    if(!scoreRec || !meta) return defaultRes;
    
    // Safety check for score maps, default to empty object if undefined/null
    const s_ww = scoreRec.scores_ww || {};
    const s_pt = scoreRec.scores_pt || {};
    const s_qa = scoreRec.scores_qa || {};
    
    const sum = (rec: Record<string, number>) => Object.values(rec).reduce((a,b)=>a+(b||0),0);
    
    // Written Works
    const totalWW = sum(s_ww);
    const maxWW = sum(meta.hps_ww || {});
    const percWW = maxWW > 0 ? (totalWW / maxWW) * 100 : 0;
    const wsWW = percWW * ((meta.weight_ww || 0) / 100);

    // Performance Tasks
    const totalPT = sum(s_pt);
    const maxPT = sum(meta.hps_pt || {});
    const percPT = maxPT > 0 ? (totalPT / maxPT) * 100 : 0;
    const wsPT = percPT * ((meta.weight_pt || 0) / 100);

    // QA
    const totalQA = sum(s_qa);
    const maxQA = sum(meta.hps_qa || {});
    const percQA = maxQA > 0 ? (totalQA / maxQA) * 100 : 0;
    const wsQA = percQA * ((meta.weight_qa || 0) / 100);

    const initialGrade = wsWW + wsPT + wsQA;
    const quarterlyGrade = transmuteGrade(initialGrade);

    return {
       initialGrade,
       quarterlyGrade,
       ww: { total: totalWW, ws: wsWW, ps: percWW || 0 }, // Ensure ps is never undefined/NaN for toFixed
       pt: { total: totalPT, ws: wsPT, ps: percPT || 0 },
       qa: { total: totalQA, ws: wsQA, ps: percQA || 0 }
    };
  };

  // SF6 Calculation
  const calculateSf6Data = (): Sf6GradeLevelData => {
    const empty = { male: 0, female: 0, total: 0 };
    const res: Sf6GradeLevelData = {
      promoted: { ...empty }, conditional: { ...empty }, retained: { ...empty },
      learningProgress: { didNotMeet: {...empty}, fairly: {...empty}, satisfactory: {...empty}, verySatisfactory: {...empty}, outstanding: {...empty} }
    };
    
    students.forEach(s => {
      const rec = academicRecords[s.id!] || ({} as Partial<AcademicRecord>);
      const sex = s.sex === 'M' ? 'male' : 'female';
      
      // Promotion Status
      if(rec.action_taken === 'Promoted') { res.promoted[sex]++; res.promoted.total++; }
      else if(rec.action_taken === 'Conditional') { res.conditional[sex]++; res.conditional.total++; }
      else if(rec.action_taken === 'Retained') { res.retained[sex]++; res.retained.total++; }
      
      // Proficiency Level (Based on General Average)
      const avg = Number(rec.general_average) || 0;
      if(avg > 0) {
        if(avg < 75) { res.learningProgress.didNotMeet[sex]++; res.learningProgress.didNotMeet.total++; }
        else if(avg < 80) { res.learningProgress.fairly[sex]++; res.learningProgress.fairly.total++; }
        else if(avg < 85) { res.learningProgress.satisfactory[sex]++; res.learningProgress.satisfactory.total++; }
        else if(avg < 90) { res.learningProgress.verySatisfactory[sex]++; res.learningProgress.verySatisfactory.total++; }
        else { res.learningProgress.outstanding[sex]++; res.learningProgress.outstanding.total++; }
      }
    });
    return res;
  };

  const renderSf2Row = (s: Student, idx: number) => {
    const record: AttendanceState = attendanceRecords[s.id!] || { days: {}, remarks: '' };
    const absences = Object.values(record.days).filter(d => d === 'x').length;
    const tardies = Object.values(record.days).filter(d => d === 'T').length;
    return (
      <tr key={s.id} className="hover:bg-green-50 group">
        <td className="px-3 py-2 border-r border-slate-100 sticky left-0 bg-white group-hover:bg-green-50 font-medium truncate">{idx + 1}. {s.last_name}, {s.first_name}</td>
        {[...Array(31)].map((_, i) => {
           const day = String(i + 1); const { isWeekend, isInvalid } = getDayStatus(i + 1); const status = record.days[day];
           return (
             <td key={i} className={`border-r border-slate-100 text-center p-0 ${isWeekend || isInvalid ? 'bg-slate-200 cursor-not-allowed' : 'cursor-pointer hover:bg-green-100'}`}
               onClick={() => { if (!isWeekend && !isInvalid) handleAttendanceToggle(s.id!, day); }}>
               {!isWeekend && !isInvalid && <div className={`w-full h-8 flex items-center justify-center ${status==='x'?'text-red-600 font-bold':status==='T'?'text-yellow-600 font-bold':''}`}>{status}</div>}
             </td>
           );
        })}
        <td className="px-3 py-2 border-r border-slate-100 text-center font-bold text-red-600">{absences}</td>
        <td className="px-3 py-2 border-r border-slate-100 text-center font-bold text-yellow-600">{tardies}</td>
        <td className="px-3 py-2 border-r border-slate-100 p-0"><input className="w-full h-full px-2 bg-transparent outline-none" value={record.remarks||''} onChange={e=>handleAttendanceRemarkChange(s.id!,e.target.value)} /></td>
      </tr>
    );
  };

  // View Renders
  const renderSF3 = () => (
     <div className="flex flex-col lg:flex-row gap-6 h-full">
        <div className="w-full lg:w-1/3 bg-white border border-slate-200 rounded-xl flex flex-col">
           <div className="p-4 border-b border-slate-200 bg-green-50 font-bold text-green-900">Learners</div>
           <div className="overflow-y-auto flex-1">
              {students.map(s => (
                 <div key={s.id} onClick={() => setSelectedStudentForBooks(s)} className={`p-3 border-b border-slate-100 cursor-pointer hover:bg-green-50 ${selectedStudentForBooks?.id === s.id ? 'bg-green-100 border-l-4 border-green-600' : ''}`}>
                    <div className="font-medium">{s.last_name}, {s.first_name}</div>
                 </div>
              ))}
           </div>
        </div>
        <div className="w-full lg:w-2/3 bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
           {selectedStudentForBooks ? (
              <>
                 <h3 className="text-lg font-bold text-green-900 mb-4">Books for {selectedStudentForBooks.first_name}</h3>
                 <div className="grid grid-cols-3 gap-2 mb-6">
                    <Input label="Title" value={newBook.book_title} onChange={e => setNewBook({...newBook, book_title: e.target.value})} />
                    <Input label="Subject" value={newBook.subject} onChange={e => setNewBook({...newBook, subject: e.target.value})} />
                    <div className="flex items-end"><Button onClick={handleSaveBook} className="w-full">Issue Book</Button></div>
                 </div>
                 <div className="overflow-auto flex-1"><table className="w-full text-sm text-left">
                    <thead className="bg-green-50 text-green-900 font-bold"><tr><th className="p-2">Title</th><th className="p-2">Subject</th><th className="p-2">Issued</th><th className="p-2">Returned</th><th className="p-2">Action</th></tr></thead>
                    <tbody>
                       {bookAssignments[selectedStudentForBooks.id!]?.map(b => (
                          <tr key={b.id} className="border-b">
                             <td className="p-2">{b.book_title}</td><td className="p-2">{b.subject}</td><td className="p-2">{b.date_issued}</td><td className="p-2">{b.date_returned || '-'}</td>
                             <td className="p-2">{!b.date_returned && <Button variant="outline" size="sm" onClick={() => handleReturnBook(b.id!)}>Return</Button>}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table></div>
              </>
           ) : <div className="text-center text-slate-400 mt-20">Select a student</div>}
        </div>
     </div>
  );

  return (
    <div className="flex h-[calc(100vh-5rem)] bg-slate-50 overflow-hidden print:bg-white print:h-auto font-sans flex-col h-screen">
      
      {/* AUTHENTICATED HEADER */}
      <header className="bg-green-800 text-white shadow-md z-30 relative border-b-4 border-yellow-500 h-20 flex-shrink-0">
        <div className="max-w-full px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white p-1 rounded-full shadow-lg">
              <img 
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSD_sDccF9FqKwyxF0rgvVKQpfEgOWyseZ0LQ&s" 
                alt="School Logo" 
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-full"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg md:text-xl tracking-tight leading-none text-white shadow-sm hidden sm:block">
                Ramon Magsaysay (CUBAO) High School
              </span>
              <span className="font-bold text-lg leading-none text-white shadow-sm sm:hidden">
                RMCHS
              </span>
              <span className="text-xs text-yellow-200 uppercase tracking-wider font-semibold mt-1">
                Centralized Grading System
              </span>
            </div>
          </div>
          
          <div className="relative">
             <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 hover:bg-green-700/50 p-2 rounded-lg transition-colors focus:outline-none"
             >
                <div className="text-right hidden sm:block">
                   <div className="text-sm font-bold leading-none">{teacherName}</div>
                   <div className="text-xs text-yellow-200 font-medium">{user_metadata.role}</div>
                </div>
                <div className="h-8 w-8 bg-yellow-500 text-green-900 rounded-full flex items-center justify-center font-bold border-2 border-yellow-300">
                   {teacherName.charAt(0)}
                </div>
                <ChevronDown className="h-4 w-4 text-green-200" />
             </button>
             
             {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-50 animate-fadeIn">
                   <div className="px-4 py-3 border-b border-slate-100 sm:hidden">
                      <p className="text-sm font-bold text-slate-800">{teacherName}</p>
                      <p className="text-xs text-slate-500">{user_metadata.role}</p>
                   </div>
                   <button 
                      onClick={() => { setShowUserMenu(false); setShowProfileSettings(true); }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-green-50 hover:text-green-800 flex items-center gap-2"
                   >
                      <Settings className="h-4 w-4" /> Profile Settings
                   </button>
                   <div className="border-t border-slate-100 my-1"></div>
                   <button 
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                   >
                      <LogOut className="h-4 w-4" /> Sign Out
                   </button>
                </div>
             )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
      <aside className={`bg-white border-r border-slate-200 transition-all z-20 print:hidden ${sidebarOpen ? 'w-64' : 'w-20'} flex flex-col`}>
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
           {sidebarOpen && <span className="font-bold text-slate-700 flex items-center gap-2"><LayoutDashboard className="h-4 w-4"/> Dashboard</span>}
           <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-slate-200 rounded text-slate-500"><Menu/></button>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
           
           {/* TEACHING SECTION */}
           {showTeachingTools && (
             <>
               {sidebarOpen ? (
                 <div className="px-4 py-2 mt-2 mb-1 bg-blue-50 border-y border-blue-100 text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center">
                   <Briefcase className="w-3 h-3 mr-2" /> Teaching Tools
                 </div>
               ) : (
                 <div className="my-2 border-b border-blue-100" />
               )}
               
               <button onClick={() => setActiveView('class_record')} className={`w-full flex items-center px-4 py-3 text-sm font-medium border-l-4 transition-colors ${activeView === 'class_record' ? 'bg-blue-50 text-blue-900 border-blue-600' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}>
                  <Calculator className="h-5 w-5 mr-3"/>{sidebarOpen && 'Class Record'}
               </button>
             </>
           )}

           {/* ADVISERY SECTION */}
           {showAdviserTools && (
             <>
                {sidebarOpen ? (
                  <div className="px-4 py-2 mt-4 mb-1 bg-green-50 border-y border-green-100 text-xs font-bold text-green-800 uppercase tracking-wider flex items-center">
                    <UserCheck className="w-3 h-3 mr-2" /> Advisory Tools
                  </div>
                ) : (
                  <div className="my-2 border-b border-green-100" />
                )}
                
                {['sf1', 'sf2', 'sf3', 'sf5', 'sf6'].map(f => (
                  <button key={f} onClick={() => setActiveView(f as any)} className={`w-full flex items-center px-4 py-3 text-sm font-medium border-l-4 transition-colors ${activeView === f ? 'bg-green-50 text-green-900 border-green-600' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}>
                      {f==='sf1' ? <FileSpreadsheet className="h-5 w-5 mr-3"/> : f==='sf2' ? <Calendar className="h-5 w-5 mr-3"/> : f==='sf3' ? <Library className="h-5 w-5 mr-3"/> : <BarChart className="h-5 w-5 mr-3"/>}
                      {sidebarOpen && `School Form ${f.replace('sf','')}`}
                  </button>
                ))}
                <button onClick={() => setActiveView('sf9')} className={`w-full flex items-center px-4 py-3 text-sm font-medium border-l-4 transition-colors ${activeView === 'sf9' ? 'bg-green-50 text-green-900 border-green-600' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}>
                    <GraduationCap className="h-5 w-5 mr-3"/>{sidebarOpen && 'SF9 (Report Card)'}
                </button>
             </>
           )}
           
           {/* ADMINISTRATION SECTION */}
           {showAdminTools && (
              <>
                 {sidebarOpen ? (
                   <div className="px-4 py-2 mt-4 mb-1 bg-purple-50 border-y border-purple-100 text-xs font-bold text-purple-800 uppercase tracking-wider flex items-center">
                     <ShieldCheck className="w-3 h-3 mr-2" /> Administration
                   </div>
                 ) : (
                   <div className="my-2 border-b border-purple-100" />
                 )}
                 
                 <button onClick={() => setActiveView('admin_sections')} className={`w-full flex items-center px-4 py-3 text-sm font-medium border-l-4 transition-colors ${activeView === 'admin_sections' ? 'bg-purple-50 text-purple-900 border-purple-600' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}>
                    <Settings className="h-5 w-5 mr-3"/>{sidebarOpen && 'Admin Panel'}
                 </button>
              </>
           )}
        </div>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col relative">
         <div className="bg-white border-b border-slate-200 p-6 print:hidden">
            <h1 className="text-2xl font-bold text-green-900 flex items-center gap-2">
               {activeView === 'class_record' ? 'Class Record' : activeView === 'admin_sections' ? 'Section & Adviser Management' : activeView.toUpperCase()}
               {activeView === 'admin_sections' && (
                 <button 
                   onClick={fetchAdminData} 
                   className="ml-4 p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-green-700 transition-colors"
                   title="Refresh Data"
                 >
                   <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                 </button>
               )}
            </h1>
            <div className="mt-4 flex gap-2">
               {activeView === 'sf1' && (
                  <>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <Button variant="outline" onClick={handleDownloadTemplate}><Download className="h-4 w-4 mr-2"/> Template</Button>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 mr-2"/> Upload CSV</Button>
                    <Button onClick={() => setShowAddStudentModal(true)}><Plus className="h-4 w-4 mr-2"/> Add Student</Button>
                  </>
               )}
               {activeView === 'sf2' && <Button onClick={saveAttendance} isLoading={savingAttendance}><Save className="h-4 w-4 mr-2"/> Save Attendance</Button>}
               {activeView === 'sf5' && <Button onClick={saveSf5Data} isLoading={savingSf5}><Save className="h-4 w-4 mr-2"/> Save SF5</Button>}
               {activeView === 'sf9' && <Button onClick={saveSf9Data}><Save className="h-4 w-4 mr-2"/> Save Grades</Button>}
               {activeView === 'class_record' && <Button onClick={saveClassRecord} isLoading={loading}><Save className="h-4 w-4 mr-2"/> Save Record</Button>}
            </div>
         </div>

         <div className="flex-1 overflow-auto p-6 bg-slate-50 print:p-0 print:bg-white">
            {/* ... SF1 to SF9 views ... */}
            {/* Same SF1 Code as previous... */}
            {activeView === 'sf1' && (
               <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto">
                  <table className="min-w-[3000px] w-full text-xs text-left">
                     <thead className="bg-green-50 text-green-900 font-bold border-b border-green-100">
                        <tr>
                           <th className="p-3 sticky left-0 bg-green-50 z-10 w-32 border-r">LRN</th>
                           <th className="p-3 sticky left-[128px] bg-green-50 z-10 w-40 border-r">Last Name</th>
                           <th className="p-3 sticky left-[288px] bg-green-50 z-10 w-40 border-r">First Name</th>
                           {/* ... columns ... */}
                           <th className="p-3 border-r">Middle Name</th>
                           <th className="p-3 border-r">Ext</th>
                           <th className="p-3 border-r">Sex</th>
                           <th className="p-3 border-r">Birth Date</th>
                           <th className="p-3 border-r">Age</th>
                           <th className="p-3 border-r">Birth Place</th>
                           <th className="p-3 border-r">Religion</th>
                           <th className="p-3 border-r">House #</th>
                           <th className="p-3 border-r">Barangay</th>
                           <th className="p-3 border-r">Municipality</th>
                           <th className="p-3 border-r">Province</th>
                           <th className="p-3 border-r">Zip</th>
                           <th className="p-3 border-r">Father's Name</th>
                           <th className="p-3 border-r">Mother's Maiden Name</th>
                           <th className="p-3 border-r">Guardian's Name</th>
                           <th className="p-3 border-r">Relationship</th>
                           <th className="p-3 border-r">Contact</th>
                           <th className="p-3 border-r">Modality</th>
                           <th className="p-3 border-r">Remarks</th>
                           <th className="p-3 border-r text-center sticky right-0 bg-green-50 z-10">Action</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {students.map(s => (
                           <tr key={s.id} className="hover:bg-green-50 group">
                              <td className="p-3 sticky left-0 bg-white group-hover:bg-green-50 border-r">{s.lrn}</td>
                              <td className="p-3 sticky left-[128px] bg-white group-hover:bg-green-50 font-bold border-r">{s.last_name}</td>
                              <td className="p-3 sticky left-[288px] bg-white group-hover:bg-green-50 font-bold border-r">{s.first_name}</td>
                              <td className="p-3 border-r">{s.middle_name}</td>
                              <td className="p-3 border-r">{s.extension_name}</td>
                              <td className="p-3 border-r">{s.sex}</td>
                              <td className="p-3 border-r">{s.birth_date}</td>
                              <td className="p-3 border-r">{s.age}</td>
                              <td className="p-3 border-r">{s.birth_place}</td>
                              <td className="p-3 border-r">{s.religion}</td>
                              <td className="p-3 border-r">{s.address_house_no}</td>
                              <td className="p-3 border-r">{s.address_barangay}</td>
                              <td className="p-3 border-r">{s.address_municipality}</td>
                              <td className="p-3 border-r">{s.address_province}</td>
                              <td className="p-3 border-r">{s.address_zip}</td>
                              <td className="p-3 border-r">{s.father_name}</td>
                              <td className="p-3 border-r">{s.mother_maiden_name}</td>
                              <td className="p-3 border-r">{s.guardian_name}</td>
                              <td className="p-3 border-r">{s.guardian_relationship}</td>
                              <td className="p-3 border-r">{s.guardian_contact}</td>
                              <td className="p-3 border-r">{s.learning_modality}</td>
                              <td className="p-3 border-r">{s.remarks}</td>
                              <td className="p-3 flex gap-2 justify-center sticky right-0 bg-white group-hover:bg-green-50 border-l shadow-[-4px_0_4px_-2px_rgba(0,0,0,0.1)]">
                                 <button onClick={() => handleEditStudent(s)} className="text-green-600 bg-green-50 p-1 rounded hover:bg-green-100"><Edit2 className="h-4 w-4"/></button>
                                 <button onClick={() => handleDeleteStudent(s.id!)} className="text-red-500 bg-red-50 p-1 rounded hover:bg-red-100"><Trash2 className="h-4 w-4"/></button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            )}
            
            {activeView === 'sf2' && (
               <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto">
                  <table className="min-w-[1500px] w-full text-xs text-left">
                     <thead className="bg-green-50 text-green-900 font-bold border-b border-green-100">
                        <tr><th className="p-2 sticky left-0 bg-green-50">Name</th>{[...Array(31)].map((_,i)=><th key={i} className={`p-1 text-center w-8 ${getDayStatus(i+1).isWeekend?'bg-slate-200':''}`}>{i+1}</th>)}<th className="p-2 text-center">Abs</th><th className="p-2 text-center">Tdy</th><th className="p-2">Remarks</th></tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        <tr className="bg-slate-100"><td colSpan={36} className="px-3 py-1 font-bold">MALE</td></tr>
                        {students.filter(s=>s.sex==='M').map((s,i)=>renderSf2Row(s,i))}
                        <tr className="bg-slate-100"><td colSpan={36} className="px-3 py-1 font-bold">FEMALE</td></tr>
                        {students.filter(s=>s.sex==='F').map((s,i)=>renderSf2Row(s,i))}
                     </tbody>
                  </table>
               </div>
            )}

            {/* Other SF Views... same as before... */}
            {activeView === 'sf3' && renderSF3()}
            {activeView === 'sf5' && (
               <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto p-4">
                  {/* SF5 Content */}
                  <h2 className="text-lg font-bold mb-4 text-green-900">Report on Promotion and Learning Progress</h2>
                 <table className="w-full text-sm text-left border-collapse">
                   <thead className="bg-green-50 text-green-900 border-b border-green-100">
                     <tr>
                       <th className="p-3 w-16">LRN</th>
                       <th className="p-3 w-48">Name</th>
                       <th className="p-3 w-24">General Average</th>
                       <th className="p-3 w-32">Action Taken</th>
                       <th className="p-3">Incomplete Subjects / Remarks</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     <tr className="bg-slate-50"><td colSpan={5} className="p-2 font-bold">MALE</td></tr>
                     {students.filter(s=>s.sex==='M').map(s => (
                       <tr key={s.id}>
                         <td className="p-2">{s.lrn}</td>
                         <td className="p-2 font-medium">{s.last_name}, {s.first_name}</td>
                         <td className="p-2"><input className="w-full p-1 border rounded" value={academicRecords[s.id!]?.general_average||''} onChange={e=>handleAcademicRecordChange(s.id!,'general_average',e.target.value)} type="number" /></td>
                         <td className="p-2">
                           <select className="w-full p-1 border rounded" value={academicRecords[s.id!]?.action_taken||''} onChange={e=>handleAcademicRecordChange(s.id!,'action_taken',e.target.value)}>
                             <option value="">--</option><option value="Promoted">Promoted</option><option value="Conditional">Conditional</option><option value="Retained">Retained</option>
                           </select>
                         </td>
                         <td className="p-2"><input className="w-full p-1 border rounded" value={academicRecords[s.id!]?.incomplete_subjects||''} onChange={e=>handleAcademicRecordChange(s.id!,'incomplete_subjects',e.target.value)} /></td>
                       </tr>
                     ))}
                     <tr className="bg-slate-50"><td colSpan={5} className="p-2 font-bold">FEMALE</td></tr>
                     {students.filter(s=>s.sex==='F').map(s => (
                       <tr key={s.id}>
                         <td className="p-2">{s.lrn}</td>
                         <td className="p-2 font-medium">{s.last_name}, {s.first_name}</td>
                         <td className="p-2"><input className="w-full p-1 border rounded" value={academicRecords[s.id!]?.general_average||''} onChange={e=>handleAcademicRecordChange(s.id!,'general_average',e.target.value)} type="number" /></td>
                         <td className="p-2">
                           <select className="w-full p-1 border rounded" value={academicRecords[s.id!]?.action_taken||''} onChange={e=>handleAcademicRecordChange(s.id!,'action_taken',e.target.value)}>
                             <option value="">--</option><option value="Promoted">Promoted</option><option value="Conditional">Conditional</option><option value="Retained">Retained</option>
                           </select>
                         </td>
                         <td className="p-2"><input className="w-full p-1 border rounded" value={academicRecords[s.id!]?.incomplete_subjects||''} onChange={e=>handleAcademicRecordChange(s.id!,'incomplete_subjects',e.target.value)} /></td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            )}
            {activeView === 'sf6' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto p-8">
                 {/* SF6 Content - Kept Concise */}
                 <h2 className="text-xl font-bold mb-6 text-green-900 text-center">School Form 6: Summarized Report on Promotion</h2>
                 {(() => {
                    const data = calculateSf6Data();
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                           <h3 className="font-bold mb-2">Summary of Status</h3>
                           <table className="w-full border text-sm">
                             <thead className="bg-slate-100"><tr><th className="border p-2">Status</th><th className="border p-2">Male</th><th className="border p-2">Female</th><th className="border p-2">Total</th></tr></thead>
                             <tbody>
                               <tr><td className="border p-2">Promoted</td><td className="border p-2 text-center">{data.promoted.male}</td><td className="border p-2 text-center">{data.promoted.female}</td><td className="border p-2 text-center font-bold">{data.promoted.total}</td></tr>
                               <tr><td className="border p-2">Conditional</td><td className="border p-2 text-center">{data.conditional.male}</td><td className="border p-2 text-center">{data.conditional.female}</td><td className="border p-2 text-center font-bold">{data.conditional.total}</td></tr>
                               <tr><td className="border p-2">Retained</td><td className="border p-2 text-center">{data.retained.male}</td><td className="border p-2 text-center">{data.retained.female}</td><td className="border p-2 text-center font-bold">{data.retained.total}</td></tr>
                             </tbody>
                           </table>
                        </div>
                        <div>
                           <h3 className="font-bold mb-2">Learning Progress</h3>
                           <table className="w-full border text-sm">
                             <thead className="bg-slate-100"><tr><th className="border p-2">Level</th><th className="border p-2">Male</th><th className="border p-2">Female</th><th className="border p-2">Total</th></tr></thead>
                             <tbody>
                               <tr><td className="border p-2">Did Not Meet (75 below)</td><td className="border p-2 text-center">{data.learningProgress.didNotMeet.male}</td><td className="border p-2 text-center">{data.learningProgress.didNotMeet.female}</td><td className="border p-2 text-center font-bold">{data.learningProgress.didNotMeet.total}</td></tr>
                               <tr><td className="border p-2">Fairly Satisfactory (75-79)</td><td className="border p-2 text-center">{data.learningProgress.fairly.male}</td><td className="border p-2 text-center">{data.learningProgress.fairly.female}</td><td className="border p-2 text-center font-bold">{data.learningProgress.fairly.total}</td></tr>
                               <tr><td className="border p-2">Satisfactory (80-84)</td><td className="border p-2 text-center">{data.learningProgress.satisfactory.male}</td><td className="border p-2 text-center">{data.learningProgress.satisfactory.female}</td><td className="border p-2 text-center font-bold">{data.learningProgress.satisfactory.total}</td></tr>
                               <tr><td className="border p-2">Very Satisfactory (85-89)</td><td className="border p-2 text-center">{data.learningProgress.verySatisfactory.male}</td><td className="border p-2 text-center">{data.learningProgress.verySatisfactory.female}</td><td className="border p-2 text-center font-bold">{data.learningProgress.verySatisfactory.total}</td></tr>
                               <tr><td className="border p-2">Outstanding (90-100)</td><td className="border p-2 text-center">{data.learningProgress.outstanding.male}</td><td className="border p-2 text-center">{data.learningProgress.outstanding.female}</td><td className="border p-2 text-center font-bold">{data.learningProgress.outstanding.total}</td></tr>
                             </tbody>
                           </table>
                        </div>
                      </div>
                    );
                 })()}
              </div>
            )}
            {activeView === 'sf9' && (
               <div className="flex flex-col gap-6">
                 {/* SF9 UI omitted for brevity, logic identical */}
                 {/* ... Student Select ... */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 print:hidden">
                     <label className="block text-sm font-medium text-slate-700 mb-2">Select Student</label>
                     <select className="w-full border border-slate-300 rounded-lg p-2" onChange={(e) => { const s = students.find(st => st.id === e.target.value); setSf9Student(s || null); }}>
                        <option value="">-- Choose a Student --</option>
                        {students.map(s => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name}</option>)}
                     </select>
                  </div>
                  {/* ... Report Card Body ... */}
                  {sf9Student && (
                     <div className="bg-white p-8 border border-slate-200 shadow-sm print:border-none print:shadow-none max-w-4xl mx-auto">
                        <div className="text-center mb-8 border-b-2 border-green-800 pb-4">
                           <h1 className="text-2xl font-bold font-serif text-green-900 uppercase">Ramon Magsaysay (CUBAO) High School</h1>
                           <p className="text-sm">Quezon City, NCR</p>
                           <h2 className="text-xl font-bold mt-4 uppercase">Learner's Progress Report Card</h2>
                           <div className="mt-4 grid grid-cols-2 text-left text-sm">
                              <div>Name: <span className="font-bold">{sf9Student.last_name}, {sf9Student.first_name}</span></div>
                              <div>LRN: <span className="font-bold">{sf9Student.lrn}</span></div>
                              <div>Grade: <span className="font-bold">{sf9Student.grade_level} - {sf9Student.section}</span></div>
                              <div>Sex: <span className="font-bold">{sf9Student.sex}</span></div>
                           </div>
                        </div>
                        {/* Grades Table */}
                        <div className="mb-8">
                           <h3 className="font-bold text-center bg-green-100 py-1 mb-2 border border-green-300">REPORT ON LEARNING PROGRESS AND ACHIEVEMENT</h3>
                           <table className="w-full text-sm border-collapse border border-slate-400">
                              <thead>
                                 <tr className="bg-slate-100"><th className="border border-slate-400 p-2 text-left">Learning Areas</th><th className="border border-slate-400 w-12">Q1</th><th className="border border-slate-400 w-12">Q2</th><th className="border border-slate-400 w-12">Q3</th><th className="border border-slate-400 w-12">Q4</th><th className="border border-slate-400 w-16">Final</th><th className="border border-slate-400 w-24">Remarks</th></tr>
                              </thead>
                              <tbody>
                                 {sf9Grades.map((g, i) => (
                                    <tr key={g.subject}>
                                       <td className="border border-slate-400 p-2">{g.subject}</td>
                                       {[1,2,3,4].map(q => <td key={q} className="border border-slate-400 p-0"><input className="w-full text-center outline-none bg-transparent" value={(g as any)[`quarter_${q}`]} onChange={e => handleSf9GradeChange(i, `quarter_${q}` as any, e.target.value)} /></td>)}
                                       <td className="border border-slate-400 p-0"><input className="w-full text-center outline-none bg-transparent font-bold" value={g.final_grade||''} onChange={e=>handleSf9GradeChange(i,'final_grade',e.target.value)} /></td>
                                       <td className="border border-slate-400 p-0"><input className="w-full text-center outline-none bg-transparent text-xs" value={g.remarks||''} onChange={e=>handleSf9GradeChange(i,'remarks',e.target.value)} /></td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                        {/* Values Table */}
                        <div className="mb-8 page-break-inside-avoid">
                           <h3 className="font-bold text-center bg-green-100 py-1 mb-2 border border-green-300">REPORT ON LEARNER'S OBSERVED VALUES</h3>
                           <table className="w-full text-sm border-collapse border border-slate-400">
                              <thead>
                                 <tr className="bg-slate-100"><th className="border border-slate-400 p-2 text-left w-32">Core Values</th><th className="border border-slate-400 p-2 text-left">Behavior Statements</th><th className="border border-slate-400 w-12">Q1</th><th className="border border-slate-400 w-12">Q2</th><th className="border border-slate-400 w-12">Q3</th><th className="border border-slate-400 w-12">Q4</th></tr>
                              </thead>
                              <tbody>
                                 {sf9Values.map((v, i) => (
                                    <tr key={i}>
                                       {(i === 0 || sf9Values[i-1].core_value !== v.core_value) && (
                                         <td rowSpan={sf9Values.filter(val => val.core_value === v.core_value).length} className="border border-slate-400 p-2 align-top font-bold bg-slate-50">{v.core_value}</td>
                                       )}
                                       <td className="border border-slate-400 p-2">{v.behavior_statement}</td>
                                       {['q1','q2','q3','q4'].map(q => <td key={q} className="border border-slate-400 p-0"><input className="w-full text-center outline-none bg-transparent" value={(v as any)[q]} onChange={e => handleSf9ValueChange(i, q, e.target.value)} /></td>)}
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                           <p className="text-xs mt-2 italic text-slate-500">Marking: AO (Always Observed), SO (Sometimes Observed), RO (Rarely Observed), NO (Not Observed)</p>
                        </div>
                        {/* Attendance Table */}
                        <div className="mb-8 page-break-inside-avoid">
                           <h3 className="font-bold text-center bg-green-100 py-1 mb-2 border border-green-300">ATTENDANCE RECORD</h3>
                           <table className="w-full text-sm border-collapse border border-slate-400 text-center">
                              <thead>
                                 <tr className="bg-slate-100">
                                   <th className="border border-slate-400 p-1">Month</th>
                                   {[...Array(12)].map((_,i) => <th key={i} className="border border-slate-400 p-1 w-8">{i+1}</th>)}
                                   <th className="border border-slate-400 p-1">Total</th>
                                 </tr>
                              </thead>
                              <tbody>
                                 <tr>
                                    <td className="border border-slate-400 p-1 font-bold text-left pl-2">Days Present</td>
                                    {[...Array(12)].map((_,i) => <td key={i} className="border border-slate-400 p-1">{sf9Attendance[String(i+1).padStart(2,'0')]?.present || 0}</td>)}
                                    <td className="border border-slate-400 p-1 font-bold">{Object.values(sf9Attendance).reduce((acc, curr: any) => acc + curr.present, 0)}</td>
                                 </tr>
                                 <tr>
                                    <td className="border border-slate-400 p-1 font-bold text-left pl-2">Days Absent</td>
                                    {[...Array(12)].map((_,i) => <td key={i} className="border border-slate-400 p-1">{sf9Attendance[String(i+1).padStart(2,'0')]?.absent || 0}</td>)}
                                    <td className="border border-slate-400 p-1 font-bold">{Object.values(sf9Attendance).reduce((acc, curr: any) => acc + curr.absent, 0)}</td>
                                 </tr>
                              </tbody>
                           </table>
                        </div>
                     </div>
                  )}
               </div>
            )}
            
            {/* ADMIN VIEW */}
            {activeView === 'admin_sections' && (
               <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                 
                 {/* Tabs */}
                 <div className="flex space-x-4 border-b border-slate-200 mb-6">
                    <button 
                       className={`pb-2 px-1 text-sm font-medium transition-colors ${adminTab==='sections' ? 'border-b-2 border-purple-600 text-purple-700' : 'text-slate-500 hover:text-purple-600'}`}
                       onClick={() => setAdminTab('sections')}
                    >
                       Manage Sections
                    </button>
                    <button 
                       className={`pb-2 px-1 text-sm font-medium transition-colors ${adminTab==='assignments' ? 'border-b-2 border-purple-600 text-purple-700' : 'text-slate-500 hover:text-purple-600'}`}
                       onClick={() => setAdminTab('assignments')}
                    >
                       Assign Subject Teachers
                    </button>
                    <button 
                       className={`pb-2 px-1 text-sm font-medium transition-colors ${adminTab==='users' ? 'border-b-2 border-purple-600 text-purple-700' : 'text-slate-500 hover:text-purple-600'}`}
                       onClick={() => setAdminTab('users')}
                    >
                       Manage Users
                    </button>
                 </div>
                 
                 {/* Manage Sections Tab */}
                 {adminTab === 'sections' && (
                    <>
                       <div className="flex justify-between items-center mb-6">
                         <h2 className="text-lg font-bold text-green-900">{isEditingSection ? 'Edit Section' : 'Add New Section'}</h2>
                         <div className="flex gap-2 items-center">
                            <select className="border rounded-lg p-2 text-sm" value={newSection.grade_level} onChange={e=>setNewSection({...newSection, grade_level: e.target.value})}>
                              <option value="">Select Grade</option>{Object.values(GradeLevel).map(g=><option key={g} value={g}>{g}</option>)}
                            </select>
                            <input className="border rounded-lg p-2 text-sm" placeholder="Section Name" value={newSection.section_name} onChange={e=>setNewSection({...newSection, section_name: e.target.value})} />
                            <Button onClick={handleAddSection}>{isEditingSection ? 'Update' : 'Add'}</Button>
                            {isEditingSection && <Button variant="outline" onClick={()=>{setIsEditingSection(false); setNewSection({grade_level:'',section_name:''}); setEditingSectionId(null);}}>Cancel</Button>}
                         </div>
                       </div>
                       
                       <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left border-collapse">
                             <thead className="bg-purple-50 text-purple-900">
                                <tr><th className="p-3 border-b">Grade Level</th><th className="p-3 border-b">Section Name</th><th className="p-3 border-b">Class Adviser</th><th className="p-3 border-b">Actions</th></tr>
                             </thead>
                             <tbody>
                                {allSections.map(sec => (
                                   <tr key={sec.id} className="border-b hover:bg-slate-50">
                                      <td className="p-3 font-medium">{sec.grade_level}</td>
                                      <td className="p-3">{sec.section_name}</td>
                                      <td className="p-3">
                                         <div className="flex items-center gap-2">
                                            <select className="border p-1 rounded text-xs w-64" 
                                               value={sec.adviser_id || ''} 
                                               onChange={(e) => handleAssignAdviser(sec.id!, e.target.value)}
                                            >
                                               <option value="">-- Assign Adviser --</option>
                                               
                                               {(() => {
                                                  // Group 1: Recommended
                                                  const recommended = allTeachers.filter(t => {
                                                     const grades = t.additional_grades || [];
                                                     return t.main_grade_level === sec.grade_level || grades.includes(sec.grade_level);
                                                  });
                                                  
                                                  // Group 2: Others (Exclude recommended)
                                                  const others = allTeachers.filter(t => !recommended.includes(t));

                                                  const renderOption = (t: SimpleTeacherProfile) => {
                                                     // Check if assigned elsewhere
                                                     const assignedSec = allSections.find(s => s.adviser_id === t.id && s.id !== sec.id);
                                                     const isAssignedElsewhere = !!assignedSec;
                                                     const isCurrent = sec.adviser_id === t.id;
                                                     
                                                     return (
                                                        <option key={t.id} value={t.id} disabled={isAssignedElsewhere && !isCurrent}>
                                                           {getTeacherName(t)} {isAssignedElsewhere ? `(Assigned to ${assignedSec?.section_name})` : ''}
                                                        </option>
                                                     );
                                                  };

                                                  return (
                                                     <>
                                                        {recommended.length > 0 && (
                                                           <optgroup label="Recommended (Grade Match)">
                                                              {recommended.map(renderOption)}
                                                           </optgroup>
                                                        )}
                                                        {others.length > 0 && (
                                                           <optgroup label="Other Teachers">
                                                              {others.map(renderOption)}
                                                           </optgroup>
                                                        )}
                                                     </>
                                                  );
                                               })()}

                                            </select>
                                         </div>
                                      </td>
                                      <td className="p-3">
                                         <button onClick={() => handleStartEditSection(sec)} className="text-slate-500 hover:text-green-600 transition-colors">
                                            <Pencil className="h-4 w-4" />
                                         </button>
                                      </td>
                                   </tr>
                                ))}
                                {allSections.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-500">No sections found. Add one above.</td></tr>}
                             </tbody>
                          </table>
                       </div>
                    </>
                 )}
                 
                 {/* Assign Teachers Tab */}
                 {adminTab === 'assignments' && (
                    <div>
                       <div className="mb-6 flex gap-4 items-center bg-purple-50 p-4 rounded-lg border border-purple-100">
                          <label className="font-bold text-purple-900 text-sm">Select Section:</label>
                          <select 
                             className="border border-slate-300 rounded-md p-2 w-64 text-sm"
                             value={selectedSectionForAssign}
                             onChange={(e) => setSelectedSectionForAssign(e.target.value)}
                          >
                             <option value="">-- Choose Section --</option>
                             {allSections.map(s => (
                                <option key={s.id} value={s.id}>{s.grade_level} - {s.section_name}</option>
                             ))}
                          </select>
                       </div>
                       
                       {selectedSectionForAssign ? (
                          <div className="border rounded-lg overflow-hidden">
                             <table className="w-full text-sm">
                                <thead className="bg-slate-100 border-b">
                                   <tr>
                                      <th className="p-3 text-left w-1/3 font-semibold text-slate-700">Subject</th>
                                      <th className="p-3 text-left w-2/3 font-semibold text-slate-700">Assigned Teacher</th>
                                   </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                   {Object.values(Subject).map(sub => {
                                      // Get current section to check grade level requirement
                                      const currentSection = allSections.find(s => s.id === selectedSectionForAssign);
                                      
                                      // 1. Qualified Teachers (Subject AND Grade Level Match)
                                      const qualifiedTeachers = allTeachers.filter(t => {
                                          const addSubjects = t.additional_subjects || [];
                                          const addGrades = t.additional_grades || [];
                                          
                                          // Must match Subject
                                          const subjectMatch = t.main_subject === sub || addSubjects.includes(sub);
                                          
                                          // Must match Grade Level (if section is known)
                                          let gradeMatch = true;
                                          if (currentSection) {
                                              gradeMatch = t.main_grade_level === currentSection.grade_level || addGrades.includes(currentSection.grade_level);
                                          }
                                          
                                          return subjectMatch && gradeMatch;
                                      });
                                      
                                      // 2. Others (Fallback - Just Subject Match)
                                      const otherTeachers = allTeachers.filter(t => {
                                          const addSubjects = t.additional_subjects || [];
                                          const subjectMatch = t.main_subject === sub || addSubjects.includes(sub);
                                          return subjectMatch && !qualifiedTeachers.includes(t);
                                      });

                                      return (
                                        <tr key={sub} className="hover:bg-slate-50">
                                           <td className="p-3 font-medium text-slate-800">{sub}</td>
                                           <td className="p-3">
                                              <select 
                                                 className="w-full md:w-96 border border-slate-300 rounded-md p-2 text-sm bg-white"
                                                 value={currentAssignments[sub] || ''}
                                                 onChange={(e) => handleAssignSubjectTeacher(sub, e.target.value)}
                                              >
                                                 <option value="">-- No Teacher Assigned --</option>
                                                 
                                                 {qualifiedTeachers.length > 0 && (
                                                    <optgroup label="Recommended (Subject & Grade Match)">
                                                       {qualifiedTeachers.map(t => (
                                                          <option key={t.id} value={t.id}>{getTeacherName(t)}</option>
                                                       ))}
                                                    </optgroup>
                                                 )}
                                                 
                                                 {otherTeachers.length > 0 && (
                                                    <optgroup label="Other Teachers (Subject Match Only)">
                                                       {otherTeachers.map(t => (
                                                          <option key={t.id} value={t.id}>{getTeacherName(t)}</option>
                                                       ))}
                                                    </optgroup>
                                                 )}
                                              </select>
                                           </td>
                                        </tr>
                                      );
                                   })}
                                </tbody>
                             </table>
                          </div>
                       ) : (
                          <div className="text-center py-12 border border-dashed rounded-lg text-slate-400">
                             Please select a section to manage subject assignments.
                          </div>
                       )}
                    </div>
                 )}

                 {/* User Management Tab - Same as before... */}
                 {adminTab === 'users' && (
                    <div>
                       <h2 className="text-lg font-bold text-purple-900 mb-4">User Role Management</h2>
                       <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
                          <table className="w-full text-sm text-left">
                             <thead className="bg-purple-50 text-purple-900 font-bold">
                                <tr>
                                   <th className="p-3 border-b">Name</th>
                                   <th className="p-3 border-b">Email / Username</th>
                                   <th className="p-3 border-b">Assigned Grade</th>
                                   <th className="p-3 border-b">Assigned Subject</th>
                                   <th className="p-3 border-b">Role</th>
                                   <th className="p-3 border-b">Actions</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-100">
                                {allTeachers.map(t => (
                                   <tr key={t.id} className="hover:bg-slate-50">
                                      <td className="p-3 font-medium">{getTeacherName(t)}</td>
                                      <td className="p-3">
                                         <div className="flex flex-col">
                                            <span>{t.email || 'No email'}</span>
                                            <span className="text-xs text-slate-400">{t.username}</span>
                                         </div>
                                      </td>
                                      <td className="p-3">
                                         <select 
                                            className="border rounded p-1 text-xs w-28" 
                                            value={t.main_grade_level || ''}
                                            onChange={(e) => handleUpdateUserFields(t.id, 'main_grade_level', e.target.value)}
                                         >
                                            <option value="">--</option>
                                            {Object.values(GradeLevel).map(g => <option key={g} value={g}>{g}</option>)}
                                         </select>
                                      </td>
                                      <td className="p-3">
                                          <select 
                                            className="border rounded p-1 text-xs w-32" 
                                            value={t.main_subject || ''}
                                            onChange={(e) => handleUpdateUserFields(t.id, 'main_subject', e.target.value)}
                                         >
                                            <option value="">--</option>
                                            {Object.values(Subject).map(s => <option key={s} value={s}>{s}</option>)}
                                         </select>
                                      </td>
                                      <td className="p-3">
                                         <select 
                                            className={`border rounded p-1 text-xs font-bold ${
                                               t.role === 'Admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                               t.role === 'Head Teacher' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                               'bg-slate-50'
                                            }`}
                                            defaultValue={t.role || 'Teacher'}
                                            id={`role-select-${t.id}`}
                                            onChange={(e) => handleUpdateRole(t.id, e.target.value)}
                                         >
                                            <option value="Teacher">Teacher</option>
                                            <option value="Head Teacher">Head Teacher</option>
                                            <option value="Admin">Admin</option>
                                         </select>
                                      </td>
                                      <td className="p-3">
                                         <button 
                                            onClick={() => handleResetPassword(t.email || '')} 
                                            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded flex items-center gap-1 border"
                                            title="Send Password Reset Email"
                                         >
                                            <Key className="h-3 w-3"/> Reset
                                         </button>
                                      </td>
                                   </tr>
                                ))}
                             </tbody>
                          </table>
                       </div>
                    </div>
                 )}
               </div>
            )}
            
            {/* Class Record View (omitted for brevity) */}
            {activeView === 'class_record' && (
              <div className="space-y-6">
                {/* ... existing class record ... */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 print:hidden">
                   <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
                     <Select 
                        label="Section" 
                        options={mySections.map(s => `${s.grade_level} - ${s.section_name}`)}
                        value={crSelection.section ? `${crSelection.grade} - ${crSelection.section}` : ''}
                        onChange={e => {
                           const [g, s] = e.target.value.split(' - ');
                           setCrSelection({...crSelection, grade: g, section: s});
                        }} 
                        placeholder="Select Assigned Section"
                     />
                     <Select 
                        label="Subject" 
                        options={availableSubjects} 
                        value={crSelection.subject} 
                        onChange={e => setCrSelection({...crSelection, subject: e.target.value})} 
                        placeholder={availableSubjects.length > 0 ? "Select Subject" : "No Assigned Subjects"}
                     />
                     <Select label="Quarter" options={['1', '2', '3', '4']} value={String(crSelection.quarter)} onChange={e => setCrSelection({...crSelection, quarter: parseInt(e.target.value)})} />
                   </div>
                   
                   {crMeta && (
                      <div className="flex flex-wrap gap-4 items-end border-t border-slate-100 pt-4">
                         <div className="text-sm font-bold text-slate-700 mr-2">Weights Config:</div>
                         <div className="w-24"><Input label="Written %" type="number" value={crMeta.weight_ww||0} onChange={e => handleCrMetaChange('weight_ww', parseInt(e.target.value))} /></div>
                         <div className="w-24"><Input label="Perf Task %" type="number" value={crMeta.weight_pt||0} onChange={e => handleCrMetaChange('weight_pt', parseInt(e.target.value))} /></div>
                         <div className="w-24"><Input label="Assess %" type="number" value={crMeta.weight_qa||0} onChange={e => handleCrMetaChange('weight_qa', parseInt(e.target.value))} /></div>
                         <div className="text-xs text-slate-500 pb-2">Total: {(crMeta.weight_ww||0)+(crMeta.weight_pt||0)+(crMeta.weight_qa||0)}%</div>
                      </div>
                   )}
                </div>

                {crMeta ? (
                  <div className="bg-white shadow-sm border border-slate-300 overflow-x-auto">
                    {/* ... HPS/Scores Table ... */}
                    <div className="min-w-[1400px]">
                       <div className="bg-green-800 text-white p-2 text-center text-sm font-bold">CLASS RECORD - {crSelection.subject} ({crSelection.grade}) Q{crSelection.quarter}</div>
                       <table className="w-full text-xs border-collapse">
                          <thead>
                             <tr className="bg-slate-100 border-b border-slate-300">
                                <th className="p-2 border-r border-slate-300 w-48 text-left sticky left-0 bg-slate-100 z-10">NAMES</th>
                                {/* Written Works */}
                                <th colSpan={10} className="border-r border-slate-300 bg-teal-50 text-teal-900 text-center">WRITTEN WORKS ({crMeta.weight_ww}%)</th>
                                <th className="border-r border-slate-300 bg-teal-100 w-12 text-center">Total</th>
                                <th className="border-r border-slate-300 bg-teal-100 w-12 text-center">PS</th>
                                <th className="border-r border-slate-300 bg-teal-100 w-12 text-center">WS</th>
                                {/* Performance */}
                                <th colSpan={10} className="border-r border-slate-300 bg-yellow-50 text-yellow-900 text-center">PERFORMANCE TASKS ({crMeta.weight_pt}%)</th>
                                <th className="border-r border-slate-300 bg-yellow-100 w-12 text-center">Total</th>
                                <th className="border-r border-slate-300 bg-yellow-100 w-12 text-center">PS</th>
                                <th className="border-r border-slate-300 bg-yellow-100 w-12 text-center">WS</th>
                                {/* Assessment */}
                                <th className="border-r border-slate-300 bg-green-50 text-green-900 text-center">QA1</th>
                                <th className="border-r border-slate-300 bg-green-100 w-12 text-center">Total</th>
                                <th className="border-r border-slate-300 bg-green-100 w-12 text-center">PS</th>
                                <th className="border-r border-slate-300 bg-green-100 w-12 text-center">WS</th>
                                {/* Finals */}
                                <th className="border-r border-slate-300 bg-slate-200 w-16 text-center">Initial Grade</th>
                                <th className="bg-slate-300 w-16 text-center font-bold">Quarterly Grade</th>
                             </tr>
                             <tr className="bg-slate-50 border-b border-slate-300">
                                <td className="p-2 border-r border-slate-300 font-bold sticky left-0 bg-slate-50">Highest Possible Score</td>
                                {/* HPS Inputs */}
                                {[...Array(10)].map((_,i) => <td key={`hps-ww-${i}`} className="p-0 border-r border-slate-300"><input className="w-full text-center bg-teal-50/50 outline-none" value={crMeta.hps_ww?.[i+1] || ''} onChange={e => handleHpsChange('hps_ww', String(i+1), e.target.value)} /></td>)}
                                <td className="text-center font-bold bg-teal-50">{(Object.values(crMeta.hps_ww||{}) as number[]).reduce((a,b)=>a+b,0)}</td>
                                <td className="bg-teal-50">100</td><td className="bg-teal-50">20%</td>
                                {[...Array(10)].map((_,i) => <td key={`hps-pt-${i}`} className="p-0 border-r border-slate-300"><input className="w-full text-center bg-yellow-50/50 outline-none" value={crMeta.hps_pt?.[i+1] || ''} onChange={e => handleHpsChange('hps_pt', String(i+1), e.target.value)} /></td>)}
                                <td className="text-center font-bold bg-yellow-50">{(Object.values(crMeta.hps_pt||{}) as number[]).reduce((a,b)=>a+b,0)}</td>
                                <td className="bg-yellow-50">100</td><td className="bg-yellow-50">60%</td>
                                <td className="p-0 border-r border-slate-300"><input className="w-full text-center bg-green-50/50 outline-none" value={crMeta.hps_qa?.[1] || ''} onChange={e => handleHpsChange('hps_qa', '1', e.target.value)} /></td>
                                <td className="text-center font-bold bg-green-50">{(Object.values(crMeta.hps_qa||{}) as number[]).reduce((a,b)=>a+b,0)}</td>
                                <td className="bg-green-50">100</td><td className="bg-green-50">20%</td>
                                <td className="bg-slate-100">100</td><td className="bg-slate-200">100</td>
                             </tr>
                          </thead>
                          <tbody>
                             {['M','F'].map(sex => (
                                <React.Fragment key={sex}>
                                   <tr className="bg-slate-200 font-bold"><td colSpan={40} className="p-1 pl-4 sticky left-0 bg-slate-200">{sex === 'M' ? 'MALE' : 'FEMALE'}</td></tr>
                                   {students.filter(s => s.sex === sex).map((s, idx) => {
                                      const grades = calculateGrade(crScores[s.id!], crMeta);
                                      return (
                                        <tr key={s.id} className="hover:bg-blue-50 border-b border-slate-200 group" data-student-id={s.id}>
                                           <td className="p-2 border-r border-slate-300 font-medium whitespace-nowrap sticky left-0 bg-white group-hover:bg-blue-50 truncate w-48 z-10">{idx+1}. {s.last_name}, {s.first_name}</td>
                                           {/* WW Scores */}
                                           {[...Array(10)].map((_,i) => <td key={`ww-${i}`} className="p-0 border-r border-slate-300"><input className="w-full text-center outline-none bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500 h-full" 
                                              data-col={`scores_ww-${i+1}`} value={crScores[s.id!]?.scores_ww?.[i+1] || ''} 
                                              onChange={e => handleCrScoreChange(s.id!, 'scores_ww', String(i+1), e.target.value)}
                                              onKeyDown={e => handleKeyDown(e, s.id!, 'scores_ww', String(i+1))}
                                              onPaste={e => handlePaste(e, s.id!, 'scores_ww', i+1)}
                                           /></td>)}
                                           <td className="text-center bg-teal-50 border-r border-slate-300">{grades.ww.total}</td>
                                           <td className="text-center bg-teal-50 border-r border-slate-300">{grades.ww.ps.toFixed(2)}</td>
                                           <td className="text-center bg-teal-50 border-r border-slate-300 font-bold">{grades.ww.ws.toFixed(2)}</td>
                                           {/* PT Scores */}
                                           {[...Array(10)].map((_,i) => <td key={`pt-${i}`} className="p-0 border-r border-slate-300"><input className="w-full text-center outline-none bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500 h-full" 
                                              data-col={`scores_pt-${i+1}`} value={crScores[s.id!]?.scores_pt?.[i+1] || ''} 
                                              onChange={e => handleCrScoreChange(s.id!, 'scores_pt', String(i+1), e.target.value)}
                                              onKeyDown={e => handleKeyDown(e, s.id!, 'scores_pt', String(i+1))}
                                              onPaste={e => handlePaste(e, s.id!, 'scores_pt', i+1)}
                                           /></td>)}
                                           <td className="text-center bg-yellow-50 border-r border-slate-300">{grades.pt.total}</td>
                                           <td className="text-center bg-yellow-50 border-r border-slate-300">{grades.pt.ps.toFixed(2)}</td>
                                           <td className="text-center bg-yellow-50 border-r border-slate-300 font-bold">{grades.pt.ws.toFixed(2)}</td>
                                           {/* QA Scores */}
                                           <td className="p-0 border-r border-slate-300"><input className="w-full text-center outline-none bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500 h-full" 
                                              data-col="scores_qa-1" value={crScores[s.id!]?.scores_qa?.[1] || ''} 
                                              onChange={e => handleCrScoreChange(s.id!, 'scores_qa', '1', e.target.value)}
                                              onKeyDown={e => handleKeyDown(e, s.id!, 'scores_qa', '1')}
                                              onPaste={e => handlePaste(e, s.id!, 'scores_qa', 1)}
                                           /></td>
                                           <td className="text-center bg-green-50 border-r border-slate-300">{grades.qa.total}</td>
                                           <td className="text-center bg-green-50 border-r border-slate-300">{grades.qa.ps.toFixed(2)}</td>
                                           <td className="text-center bg-green-50 border-r border-slate-300 font-bold">{grades.qa.ws.toFixed(2)}</td>
                                           
                                           {/* Finals */}
                                           <td className="text-center font-bold bg-slate-50 border-r border-slate-300">{grades.initialGrade.toFixed(2)}</td>
                                           <td className={`text-center font-extrabold text-white ${grades.quarterlyGrade < 75 ? 'bg-red-500' : 'bg-green-700'}`}>{grades.quarterlyGrade}</td>
                                        </tr>
                                      );
                                   })}
                                </React.Fragment>
                             ))}
                          </tbody>
                       </table>
                    </div>
                  </div>
                ) : (
                   <div className="text-center py-20 text-slate-400 bg-white border border-dashed border-slate-300 rounded-xl">
                      <p>Select a Grade, Section, and Subject above to start grading.</p>
                      {crError && <p className="text-red-500 mt-2 text-sm">Error: {crError}</p>}
                   </div>
                )}
              </div>
            )}
            
            {/* Student Modal */}
            {showAddStudentModal && (
               <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                     <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                        <h2 className="text-xl font-bold text-green-900">{isEditingStudent ? 'Edit Student' : 'Add New Student'}</h2>
                        <button onClick={() => setShowAddStudentModal(false)}><X className="h-5 w-5 text-slate-400 hover:text-red-500"/></button>
                     </div>
                     <form onSubmit={handleSaveStudent} className="p-6 space-y-6">
                        <div className="bg-green-50 p-3 rounded-lg border border-green-100 mb-4 text-sm text-green-800">
                           <span className="font-bold">Note:</span> Adding to class: <span className="font-bold underline">{adviserSection?.grade_level} - {adviserSection?.section_name}</span>
                        </div>
                        
                        {/* Student Form fields... */}
                        {/* ... omitted for brevity ... */}
                        <div className="space-y-4">
                           <h3 className="font-bold text-slate-700 border-b pb-2">Basic Information</h3>
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <Input label="LRN" name="lrn" value={newStudent.lrn||''} onChange={handleInputChange} required placeholder="12-digit LRN" />
                              <Input label="Last Name" name="last_name" value={newStudent.last_name||''} onChange={handleInputChange} required />
                              <Input label="First Name" name="first_name" value={newStudent.first_name||''} onChange={handleInputChange} required />
                              {/* ... */}
                              <Select label="Sex" name="sex" value={newStudent.sex||''} onChange={handleInputChange} options={['M', 'F']} required />
                              <Input label="Birth Date" type="date" name="birth_date" value={newStudent.birth_date||''} onChange={handleInputChange} required />
                           </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                           <Button type="button" variant="outline" onClick={() => setShowAddStudentModal(false)}>Cancel</Button>
                           <Button type="submit" isLoading={loading}>{isEditingStudent ? 'Update Student' : 'Add Student'}</Button>
                        </div>
                     </form>
                  </div>
               </div>
            )}
            
            {/* PROFILE SETTINGS MODAL */}
            {showProfileSettings && (
               <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fadeIn">
                  <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col">
                     <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-green-50">
                        <h2 className="text-xl font-bold text-green-900 flex items-center gap-2">
                           <Settings className="h-5 w-5"/> Profile Settings
                        </h2>
                        <button onClick={() => setShowProfileSettings(false)}><X className="h-5 w-5 text-slate-400 hover:text-red-500"/></button>
                     </div>
                     <form onSubmit={handleUpdateMyProfile} className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Profile form fields... unchanged */}
                        <section>
                           <h3 className="font-bold text-slate-700 border-b pb-2 mb-4">Personal Information</h3>
                           {/* ... */}
                        </section>
                        <section>
                           <h3 className="font-bold text-slate-700 border-b pb-2 mb-4">Main Assignment</h3>
                           {/* ... */}
                        </section>
                        <section className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                           {/* ... Multi-grade logic ... */}
                        </section>
                        
                        <div className="pt-2 flex justify-end gap-3 border-t border-slate-100 mt-4">
                           <Button type="button" variant="outline" onClick={() => setShowProfileSettings(false)}>Cancel</Button>
                           <Button type="submit" isLoading={loading}>Save Changes</Button>
                        </div>
                     </form>
                  </div>
               </div>
            )}

         </div>
      </main>
      </div>
    </div>
  );
}