  "use client";

  import { useParams, useRouter, useSearchParams } from "next/navigation";
 import { useEffect, useState, useCallback, useMemo } from "react";
  import { onAuthStateChanged } from "firebase/auth";
  import { auth, db } from "../../../../../lib/firebase";
  import { mcqDb } from "../../../../../lib/firebaseMCQs";
  import {
    doc,
    getDoc,
    getDocs,
    addDoc,
    collection,
    updateDoc,
    serverTimestamp,
    query,
    where,
    orderBy,
  } from "firebase/firestore";
  import CheckAuth from "../../../../../lib/CheckAuth";
  import dynamic from "next/dynamic";
  import { parseCourseUrl, createSlug } from "../../../../../lib/urlUtils";
  import { isCrtStudentRole, isScopedInternshipRole } from "../../../../../lib/studentRole";

  const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

  // Stateless helpers
  const getDefaultStarter = (language) => {
    if (language === "java") return `public class Main {\n  public static void main(String[] args) {\n    // Write your solution here\n    System.out.println("Hello, World!");\n  }\n}`;
    if (language === "python") return `# Write your solution here\nprint("Hello, World!")`;
    if (language === "c") return `#include <stdio.h>\nint main(){\n  // Write your solution here\n  printf("Hello, World!\\n");\n  return 0;\n}`;
    if (language === "cpp") return `#include <iostream>\nusing namespace std;\n\nint main() {\n  // Write your solution here\n  cout << "Hello, World!" << endl;\n  return 0;\n}`;
    if (language === "javascript") return `// Write your solution here\nconsole.log("Hello, World!");`;
    if (language === "r") return `# Write your solution here\nprint("Hello, World!")\n\n# Simple calculation\nx <- c(1, 2, 3, 4, 5)\nmean_value <- mean(x)\ncat("Mean:", mean_value, "\\n")`;
    if (language === "mysql") return `-- Write your MySQL query here\nSELECT 'Hello, World!' AS message;\n\n-- Create and query a sample table\nCREATE TABLE IF NOT EXISTS users (\n  id INT PRIMARY KEY,\n  name VARCHAR(50)\n);\n\nINSERT INTO users VALUES (1, 'John Doe');\nSELECT * FROM users;`;
    if (language === "sql") return `-- Write your SQL query here\nSELECT 'Hello, World!' AS message;\n\n-- Create and query a sample table\nCREATE TABLE IF NOT EXISTS products (\n  id INT PRIMARY KEY,\n  name VARCHAR(100),\n  price DECIMAL(10,2)\n);\n\nINSERT INTO products VALUES (1, 'Product A', 99.99);\nSELECT * FROM products;`;
    return "";
  };

  const mapLanguage = (lang) => {
    if (lang === "java") return "java";
    if (lang === "python") return "python";
    if (lang === "c") return "c";
    if (lang === "cpp") return "cpp";
    if (lang === "javascript") return "javascript";
    if (lang === "r") return "r";
    if (lang === "mysql" || lang === "sql") return "sql";
    return "plaintext";
  };

  // Helper functions for input transformation
  const transformForCompiler = (input) => {
    // Transform each line separately to preserve line breaks
    return input
      .split('\n')                    // Split by lines
      .map(line => 
        line
          .replace(/\[/g, '')         // Remove [ brackets
          .replace(/\]/g, '')         // Remove ] brackets  
          .replace(/,/g, ' ')         // Convert commas to spaces
          .replace(/#/g, '')          // Remove # prefix
          .replace(/\s+/g, ' ')       // Normalize multiple spaces to single space
          .trim()                     // Remove leading/trailing spaces
      )
      .join('\n');                    // Join lines back with line breaks
  };

  const transformForDisplay = (input) => {
    // Only transform # to " " for display, keep everything else as-is
    return input.replace(/#/g, '" "');
  };

  export default function AssignmentSubmissionPage() {
    const { id: urlSlug, assignmentId } = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryCourseId = searchParams.get("courseId");
    const queryInternshipId = searchParams.get("internshipId");

    // Parse the URL to get the course slug
    const { slug } = parseCourseUrl(urlSlug);
    const [assignment, setAssignment] = useState(null);
    const [course, setCourse] = useState(null);
    const [courseId, setCourseId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submission, setSubmission] = useState({
      mcqAnswers: {},
      codingSolution: "",
      language: "cpp"
    });
    const [existingSubmission, setExistingSubmission] = useState(null);
    const [hasAccess, setHasAccess] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [runningHidden, setRunningHidden] = useState(false);
    const [hiddenSummary, setHiddenSummary] = useState(null);
    const [hiddenStats, setHiddenStats] = useState(null); // { passCount, totalCount }
    const [testResults, setTestResults] = useState([]); // Array of test case results with outputs
    const [sampleTestResults, setSampleTestResults] = useState({}); // Object keyed by questionIndex for sample test results
    const [runningSampleTests, setRunningSampleTests] = useState({}); // Track which sample tests are running
    const [activeQuestion, setActiveQuestion] = useState(null);
    const [visitedMap, setVisitedMap] = useState({});
    const [reviewFlags, setReviewFlags] = useState({});
    const [timeLeftMs, setTimeLeftMs] = useState(null);
  const [editorDark, setEditorDark] = useState(false);
  const [internshipRole, setInternshipRole] = useState(null); // Store internship role info: { internshipId, courseId }
  const [isCopiedCourse, setIsCopiedCourse] = useState(false); // Track if this is a copied course (from copiedcourses collection)

    const scrollToQuestion = useCallback((index) => {
      setActiveQuestion(index);
      setVisitedMap((prev) => ({ ...prev, [index]: true }));
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, []);

    // Initialize current question highlight
    useEffect(() => {
      if (assignment?.questions && assignment.questions.length > 0 && (activeQuestion === null || activeQuestion === undefined)) {
        setActiveQuestion(0);
        setVisitedMap((prev) => ({ ...prev, 0: true }));
      }
    }, [assignment, activeQuestion]);

    // Determine timer based on common assignment fields (timeLimitMinutes | durationMinutes | timeLimit)
    useEffect(() => {
      const minutes = assignment?.timeLimitMinutes || assignment?.durationMinutes || assignment?.timeLimit;
      if (!minutes || Number.isNaN(Number(minutes))) return;
      const endAt = Date.now() + Number(minutes) * 60 * 1000;
      const tick = () => {
        const remaining = Math.max(0, endAt - Date.now());
        setTimeLeftMs(remaining);
        if (remaining === 0) return true;
        return false;
      };
      tick();
      const id = setInterval(() => {
        const done = tick();
        if (done) clearInterval(id);
      }, 1000);
      return () => clearInterval(id);
    }, [assignment]);

    // Single-question mode: active question set by clicks/controls

    const formatTime = (ms) => {
      if (ms == null) return null;
      const total = Math.floor(ms / 1000);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      const pad = (n) => String(n).padStart(2, '0');
      return { h: pad(h), m: pad(m), s: pad(s) };
    };

    const toggleReview = useCallback((qIndex) => {
      setReviewFlags((prev) => ({ ...prev, [qIndex]: !prev[qIndex] }));
    }, []);

    const clearAnswer = useCallback((qIndex) => {
      setSubmission((prev) => ({
        ...prev,
        mcqAnswers: { ...prev.mcqAnswers, [qIndex]: Array.isArray(prev.mcqAnswers[qIndex]) ? [] : undefined }
      }));
    }, []);

    // Memoized progress computation (replaces repeated inline IIFEs)
    const answeredProgress = useMemo(() => {
      if (!assignment) return { answered: 0, total: 0 };
      if (assignment.type === 'mcq') {
        const totalQuestions = assignment.questions?.length || 0;
        // Count questions that have been answered (considering both single and multiple answer questions)
        let answeredCount = 0;
        for (let i = 0; i < totalQuestions; i++) {
          const answer = submission.mcqAnswers[i];
          if (answer !== undefined && answer !== null) {
            // For array answers (multiple choice), check if at least one option is selected
            if (Array.isArray(answer)) {
              if (answer.length > 0) answeredCount++;
            } else {
              // For single answer
              answeredCount++;
            }
          }
        }
        return { answered: answeredCount, total: totalQuestions };
      }
      // For coding assignments, count questions that have meaningful code
      const totalQuestions = assignment.questions?.length || 0;
      if (totalQuestions === 0) return { answered: 0, total: 0 };
      
      // Check if the coding solution is meaningful (not empty and not just the starter code)
      const hasMeaningfulCode = Boolean(
        submission.codingSolution &&
        submission.codingSolution.trim() !== '' &&
        submission.codingSolution !== getDefaultStarter(submission.language)
      );
      
      // For coding, if there's meaningful code, consider all questions as potentially answered
      // since coding solutions typically address all problems in the assignment
      return { answered: hasMeaningfulCode ? totalQuestions : 0, total: totalQuestions };
    }, [assignment, submission]);

    const fetchData = useCallback(async (user) => {
      try {
        let foundCourseId = null;

        // Fetch student data and user role first (needed for both query-param and slug paths)
        const [studentDataResult, userRoleResult] = await Promise.all([
          (async () => {
            const directRef = doc(db, "students", user.uid);
            const directSnap = await getDoc(directRef);
            if (directSnap.exists()) return directSnap.data();
            const q = query(collection(db, "students"), where("uid", "==", user.uid));
            const qSnap = await getDocs(q);
            return qSnap.empty ? null : qSnap.docs[0].data();
          })(),
          (async () => {
            try {
              const userSnap = await getDoc(doc(db, "users", user.uid));
              return userSnap.exists() ? userSnap.data().role : undefined;
            } catch (_) {
              return undefined;
            }
          })()
        ]);

        const studentData = studentDataResult;
        const userRole = userRoleResult;
        const studentRole = studentData?.role;
        const isSuperAdmin = userRole === "superadmin";
        const isInternshipRole =
          isScopedInternshipRole(userRole) ||
          isScopedInternshipRole(studentRole) ||
          studentData?.isInternship === true;
        const isCrtRole =
          isCrtStudentRole(userRole) ||
          isCrtStudentRole(studentRole) ||
          studentData?.isCrt === true;

        // When opened from internship course page: load assignment from that course copy and grant access by chapter unlock
        if (queryCourseId) {
          const assignmentSnap = await getDoc(doc(mcqDb, "copiedcourses", queryCourseId, "assignments", assignmentId));
          if (!assignmentSnap.exists()) {
            if (queryInternshipId) router.push(`/internships/${queryInternshipId}/courses/${queryCourseId}`);
            else router.push(`/courses`);
            return;
          }
          const assignmentData = assignmentSnap.data();
          setAssignment({ id: assignmentSnap.id, ...assignmentData });
          setIsCopiedCourse(true);
          setCourseId(queryCourseId);

          let courseData = { id: queryCourseId, title: "Course" };
          if (queryInternshipId) {
            const courseSnap = await getDoc(doc(db, "internships", queryInternshipId, "courses", queryCourseId));
            if (courseSnap.exists()) courseData = { id: courseSnap.id, ...courseSnap.data() };
          }
          setCourse(courseData);

          const submissionCollectionPath = collection(mcqDb, "copiedcourses", queryCourseId, "assignments", assignmentId, "submissions");
          const submissionQuerySnap = await getDocs(query(submissionCollectionPath, where("studentId", "==", user.uid)));

          if (isSuperAdmin) setHasAccess(true);
          else if (isInternshipRole || isCrtRole) setHasAccess(true);
          else if (studentData?.chapterAccess && Array.isArray(studentData.chapterAccess[queryCourseId])) {
            const allowedChapters = studentData.chapterAccess[queryCourseId];
            const assignmentDay = assignmentData.day || 1;
            if (queryInternshipId) {
              const chaptersRef = collection(db, "internships", queryInternshipId, "courses", queryCourseId, "chapters");
              const chapterSnap = await getDocs(query(chaptersRef, orderBy("order", "asc")));
              const chapters = chapterSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
              const targetChapter = chapters[assignmentDay - 1];
              if (targetChapter && allowedChapters.includes(targetChapter.id)) setHasAccess(true);
            }
          }

          const userSubmission = submissionQuerySnap.empty ? null : submissionQuerySnap.docs[0];
          if (userSubmission) {
            const submissionData = userSubmission.data();
            setExistingSubmission({ id: userSubmission.id, ...submissionData });
            setSubmission({
              mcqAnswers: submissionData.mcqAnswers || {},
              codingSolution: submissionData.codingSolution || "",
              language: submissionData.language || "cpp"
            });
          }
          setLoading(false);
          return;
        }

        // No query params: resolve course by slug and load assignment from master or first matching copy
        const coursesSnap = await getDocs(collection(db, "courses"));
        const allCourses = coursesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const matchingCourse = allCourses.find((c) => createSlug(c.title) === slug);

        if (!matchingCourse) {
          router.push(`/courses`);
          return;
        }

        foundCourseId = matchingCourse.id;
        setCourse(matchingCourse);
        setCourseId(matchingCourse.id);

        let assignmentSnap = await getDoc(doc(mcqDb, "courses", foundCourseId, "assignments", assignmentId));
        let isCopied = false;
        let actualCourseId = foundCourseId;

        if (!assignmentSnap.exists()) {
          let copiedCourseId = null;
          const internshipsSnap = await getDocs(collection(db, "internships"));
          for (const internshipDoc of internshipsSnap.docs) {
            const insCoursesSnap = await getDocs(collection(db, "internships", internshipDoc.id, "courses"));
            const copiedCourse = insCoursesSnap.docs.find((courseDoc) => createSlug(courseDoc.data().title) === slug);
            if (copiedCourse) {
              copiedCourseId = copiedCourse.id;
              break;
            }
          }
          if (!copiedCourseId) {
            const crtSnap = await getDocs(collection(db, "crt"));
            for (const crtDoc of crtSnap.docs) {
              const crtCoursesSnap = await getDocs(collection(db, "crt", crtDoc.id, "courses"));
              const copiedCourse = crtCoursesSnap.docs.find((courseDoc) => createSlug(courseDoc.data().title) === slug);
              if (copiedCourse) {
                copiedCourseId = copiedCourse.id;
                break;
              }
            }
          }
          if (copiedCourseId) {
            assignmentSnap = await getDoc(doc(mcqDb, "copiedcourses", copiedCourseId, "assignments", assignmentId));
            if (assignmentSnap.exists()) {
              isCopied = true;
              actualCourseId = copiedCourseId;
            }
          }
        }

        if (!assignmentSnap.exists()) {
          router.push(`/courses/${urlSlug}`);
          return;
        }

        setIsCopiedCourse(isCopied);
        if (isCopied) setCourseId(actualCourseId);

        const submissionCollectionPath = isCopied
          ? collection(mcqDb, "copiedcourses", actualCourseId, "assignments", assignmentId, "submissions")
          : collection(mcqDb, "courses", foundCourseId, "assignments", assignmentId, "submissions");
        const submissionQuerySnap = await getDocs(query(submissionCollectionPath, where("studentId", "==", user.uid)));

        const assignmentData = assignmentSnap.data();
        setAssignment({ id: assignmentSnap.id, ...assignmentData });

        if (isSuperAdmin) setHasAccess(true);
        else if (isInternshipRole || isCrtRole) setHasAccess(true);
        else if (studentData?.chapterAccess && studentData.chapterAccess[foundCourseId]) {
          const allowedChapters = studentData.chapterAccess[foundCourseId];
          const assignmentDay = assignmentData.day || 1;
          const chapterSnap = await getDocs(query(collection(db, "courses", foundCourseId, "chapters"), orderBy("order", "asc")));
          const chapters = chapterSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          const targetChapter = chapters[assignmentDay - 1];
          if (targetChapter && allowedChapters.includes(targetChapter.id)) setHasAccess(true);
        }

        const userSubmission = submissionQuerySnap.empty ? null : submissionQuerySnap.docs[0];
        if (userSubmission) {
          const submissionData = userSubmission.data();
          setExistingSubmission({ id: userSubmission.id, ...submissionData });
          setSubmission({
            mcqAnswers: submissionData.mcqAnswers || {},
            codingSolution: submissionData.codingSolution || "",
            language: submissionData.language || "cpp"
          });
        }
      } catch (error) {
        console.error("Error fetching assignment:", error);
      } finally {
        setLoading(false);
      }
    }, [slug, assignmentId, router, urlSlug, queryCourseId, queryInternshipId]);

    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          await fetchData(user);
        } else {
          setLoading(false);
        }
      });
      return () => unsubscribe();
    }, [fetchData]);

    const handleMCQAnswer = (questionIndex, answerIndex) => {
      const question = assignment?.questions?.[questionIndex];
      const hasMultipleAnswers = Array.isArray(question?.correctAnswers) && question.correctAnswers.length > 1;
      
      if (hasMultipleAnswers) {
        // Handle checkbox (multiple selection)
        setSubmission(prev => {
          const currentAnswers = Array.isArray(prev.mcqAnswers[questionIndex]) 
            ? prev.mcqAnswers[questionIndex] 
            : [];
          
          const updatedAnswers = currentAnswers.includes(answerIndex)
            ? currentAnswers.filter(idx => idx !== answerIndex) // Remove if already selected
            : [...currentAnswers, answerIndex]; // Add if not selected
          
          return {
            ...prev,
            mcqAnswers: {
              ...prev.mcqAnswers,
              [questionIndex]: updatedAnswers
            }
          };
        });
      } else {
        // Handle radio button (single selection)
        setSubmission(prev => ({
          ...prev,
          mcqAnswers: {
            ...prev.mcqAnswers,
            [questionIndex]: answerIndex
          }
        }));
      }
    };

    const handleCodingChange = (value) => {
      setSubmission(prev => ({
        ...prev,
        codingSolution: value || ""
      }));
    };

    const handleLanguageChange = (language) => {
      setSubmission(prev => ({
        ...prev,
        language
      }));
    };

    const handleSubmitClick = () => {
      setShowConfirmDialog(true);
    };

    // const handleConfirmSubmit = async () => {
    //   if (!auth.currentUser) return;

    //   setShowConfirmDialog(false);
    //   setSubmitting(true);
    //   try {
    //     // If coding assignment, run all test cases (visible + hidden) again before submitting
    //     let resultStatus = null;
    //     let testSummary = null;
    //     if (assignment?.type === 'coding') {
    //       const allTestCases = (assignment.questions || [])
    //         .flatMap((q) => Array.isArray(q.testCases) ? q.testCases : [])
    //         .filter(Boolean);
    //       let passCount = 0;
    //       let totalCount = allTestCases.length;
    //       let hadCompilerError = false;
    //       if (totalCount > 0) {
    //         for (const tc of allTestCases) {
    //           try {
    //             const res = await fetch('/api/compile', {
    //               method: 'POST',
    //               headers: { 'Content-Type': 'application/json' },
    //               body: JSON.stringify({
    //                 language: submission.language,
    //                 source: submission.codingSolution,
    //                 stdin: transformForCompiler(tc.input), // Transform input for compiler
    //               }),
    //             });
    //             if (!res.ok) throw new Error(`HTTP ${res.status}`);
    //             const data = await res.json();
    //             const actual = (data.stdout || '').trim();
    //             const expected = (tc.expectedOutput || tc.output || '').trim();
    //             const stderr = (data.stderr || '').trim();
    //             if (stderr) hadCompilerError = true;
    //             if (actual.toLowerCase() === expected.toLowerCase()) {
    //               passCount += 1;
    //             }
    //           } catch (_) {
    //             // Treat as failed test
    //           }
    //         }
    //       }
    //       // Determine result status
    //       if (totalCount > 0 && passCount === totalCount) {
    //         resultStatus = 'success';
    //       } else if (passCount > 0 && !hadCompilerError) {
    //         resultStatus = 'partial';
    //       } else {
    //         resultStatus = 'fail';
    //       }
    //       testSummary = { passCount, totalCount };
    //     } else if (assignment?.type === 'mcq') {
    //       const questions = assignment.questions || [];
    //       const totalCount = questions.length;
    //       let totalScore = 0;
    //       let maxPossibleScore = 0;
          
    //       if (totalCount > 0) {
    //         for (let i = 0; i < questions.length; i++) {
    //           const q = questions[i];
    //           const userAnswer = submission.mcqAnswers?.[i];
              
    //           // Handle multiple correct answers with partial scoring
    //           if (Array.isArray(q.correctAnswers)) {
    //             const correctAnswers = q.correctAnswers;
    //             const totalCorrectOptions = correctAnswers.length;
    //             maxPossibleScore += 1; // Each question is worth 1 point
                
    //             if (Array.isArray(userAnswer) && userAnswer.length > 0) {
    //               // Calculate partial score based on correct selections
    //               let correctSelections = 0;
    //               let wrongSelections = 0;
                  
    //               // Count correct selections
    //               for (const selectedIndex of userAnswer) {
    //                 if (correctAnswers.includes(selectedIndex)) {
    //                   correctSelections++;
    //                 } else {
    //                   wrongSelections++;
    //                 }
    //               }
                  
    //               // Calculate partial score: (correct_selections - wrong_selections) / total_correct_options
    //               // But ensure score doesn't go below 0
    //               const partialScore = Math.max(0, (correctSelections - wrongSelections) / totalCorrectOptions);
    //               totalScore += partialScore;
    //             }
    //           } 
    //           // Handle legacy single correct answer
    //           else if (typeof q.correctAnswer === 'number') {
    //             maxPossibleScore += 1;
    //             if (userAnswer === q.correctAnswer) {
    //               totalScore += 1;
    //             }
    //           }
    //         }
    //       }
          
    //       // Convert to passCount for compatibility
    //       const passCount = Math.round(totalScore);
          
    //       if (totalCount > 0 && totalScore === maxPossibleScore) {
    //         resultStatus = 'success';
    //       } else if (totalScore > 0) {
    //         resultStatus = 'partial';
    //       } else {
    //         resultStatus = 'fail';
    //       }
    //       testSummary = { passCount, totalCount, partialScore: totalScore, maxScore: maxPossibleScore };
    //     }

    //     const baseData = {
    //       studentId: auth.currentUser.uid,
    //       studentName: auth.currentUser.displayName || auth.currentUser.email,
    //       submittedAt: serverTimestamp(),
    //       resultStatus,
    //       testSummary,
    //       ...submission,
    //     };

    //     const autoScore = testSummary?.maxScore
    //       ? Math.round((testSummary.partialScore / testSummary.maxScore) * 100)
    //       : testSummary?.totalCount
    //       ? Math.round((testSummary.passCount / testSummary.totalCount) * 100)
    //       : null;

    //     const submissionData = autoScore !== null ? { ...baseData, autoScore } : baseData;

    //     // Use the appropriate collection path (courses or copiedcourses)
    //     // For copied courses, use the actual copied course ID, not the master course ID
    //     const courseIdToUse = isCopiedCourse ? (courseId || course?.id) : (courseId || course?.id);
    //     const collectionPath = isCopiedCourse ? "copiedcourses" : "courses";
        
    //     if (existingSubmission) {
    //       // Update existing submission in MCQ Firebase
    //       await updateDoc(
    //         doc(mcqDb, collectionPath, courseIdToUse, "assignments", assignmentId, "submissions", existingSubmission.id),
    //         submissionData
    //       );
    //     } else {
    //       // Create new submission in MCQ Firebase
    //       await addDoc(
    //         collection(mcqDb, collectionPath, courseIdToUse, "assignments", assignmentId, "submissions"),
    //         submissionData
    //       );
    //     }

    //     if (assignment?.type === 'coding') {
    //       if (submissionData.resultStatus === 'success') {
    //         alert('Submission result: Success - All tests passed');
    //       } else if (submissionData.resultStatus === 'partial') {
    //         alert(`Submission result: Partial - ${submissionData.testSummary?.passCount || 0}/${submissionData.testSummary?.totalCount || 0} tests passed`);
    //       } else {
    //         alert('Submission result: Fail - 0 tests passed or compiler error');
    //       }
    //     } else {
    //       const scorePct = typeof submissionData.autoScore === 'number' ? `${submissionData.autoScore}%` : 'N/A';
    //       alert(`Assignment submitted! MCQ Score: ${scorePct}`);
    //     }
    //     router.push(`/courses/${urlSlug}`);
    //   } catch (error) {
    //     console.error("Error submitting assignment:", error);
    //     alert("Error submitting assignment. Please try again.");
    //   } finally {
    //     setSubmitting(false);
    //   }
    // };

    const handleConfirmSubmit = async () => {
      if (!auth.currentUser) return;
    
      setShowConfirmDialog(false);
      setSubmitting(true);
    
      try {
        let resultStatus = null;
        let testSummary = null;
    
        // =========================
        // CODING ASSIGNMENT
        // =========================
        if (assignment?.type === 'coding') {
          const allTestCases = (assignment.questions || [])
            .flatMap((q) => Array.isArray(q.testCases) ? q.testCases : [])
            .filter(Boolean);
    
          let passCount = 0;
          let totalCount = allTestCases.length;
          let hadCompilerError = false;
    
          if (totalCount > 0) {
            for (const tc of allTestCases) {
              try {
                const res = await fetch('/api/compile', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    language: submission.language,
                    source: submission.codingSolution,
                    stdin: transformForCompiler(tc.input),
                  }),
                });
    
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
                const data = await res.json();
                const actual = (data.stdout || '').trim();
                const expected = (tc.expectedOutput || tc.output || '').trim();
                const stderr = (data.stderr || '').trim();
    
                if (stderr) hadCompilerError = true;
                if (actual.toLowerCase() === expected.toLowerCase()) {
                  passCount += 1;
                }
              } catch (_) {
                // failed test
              }
            }
          }
    
          if (totalCount > 0 && passCount === totalCount) {
            resultStatus = 'success';
          } else if (passCount > 0 && !hadCompilerError) {
            resultStatus = 'partial';
          } else {
            resultStatus = 'fail';
          }
    
          testSummary = { passCount, totalCount };
        }
    
        // =========================
        // MCQ ASSIGNMENT (FIXED)
        // =========================
        else if (assignment?.type === 'mcq') {
          const questions = assignment.questions || [];
          const totalCount = questions.length;
    
          let totalScore = 0;
          let maxPossibleScore = 0;
    
          const normalizeAnswer = (answer) => {
            if (Array.isArray(answer)) return answer;
            if (answer === undefined || answer === null) return [];
            return [answer];
          };
    
          for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const userSelections = normalizeAnswer(submission.mcqAnswers?.[i]);
    
            // MULTIPLE CORRECT ANSWERS
            if (Array.isArray(q.correctAnswers)) {
              const correctAnswers = q.correctAnswers.map(Number);
              const totalCorrectOptions = correctAnswers.length;
    
              maxPossibleScore += 1;
    
              let correctSelections = 0;
              let wrongSelections = 0;
    
              for (const selected of userSelections) {
                if (correctAnswers.includes(selected)) {
                  correctSelections++;
                } else {
                  wrongSelections++;
                }
              }
    
              const partialScore = Math.max(
                0,
                (correctSelections - wrongSelections) / totalCorrectOptions
              );
    
              totalScore += partialScore;
            }
    
            // SINGLE CORRECT ANSWER
            else if (typeof q.correctAnswer === 'number') {
              maxPossibleScore += 1;
              if (userSelections.includes(q.correctAnswer)) {
                totalScore += 1;
              }
            }
          }
    
          const passCount = Math.round(totalScore);
    
          if (totalCount > 0 && totalScore === maxPossibleScore) {
            resultStatus = 'success';
          } else if (totalScore > 0) {
            resultStatus = 'partial';
          } else {
            resultStatus = 'fail';
          }
    
          testSummary = {
            passCount,
            totalCount,
            partialScore: totalScore,
            maxScore: maxPossibleScore,
          };
        }
    
        // =========================
        // SUBMISSION DATA
        // =========================
        const baseData = {
          studentId: auth.currentUser.uid,
          studentName: auth.currentUser.displayName || auth.currentUser.email,
          submittedAt: serverTimestamp(),
          resultStatus,
          testSummary,
          ...submission,
        };
    
        const autoScore = testSummary?.maxScore
          ? Math.round((testSummary.partialScore / testSummary.maxScore) * 100)
          : testSummary?.totalCount
          ? Math.round((testSummary.passCount / testSummary.totalCount) * 100)
          : null;
    
        const submissionData = autoScore !== null
          ? { ...baseData, autoScore }
          : baseData;
    
        const courseIdToUse = courseId || course?.id;
        const collectionPath = isCopiedCourse ? "copiedcourses" : "courses";
    
        if (existingSubmission) {
          await updateDoc(
            doc(mcqDb, collectionPath, courseIdToUse, "assignments", assignmentId, "submissions", existingSubmission.id),
            submissionData
          );
        } else {
          await addDoc(
            collection(mcqDb, collectionPath, courseIdToUse, "assignments", assignmentId, "submissions"),
            submissionData
          );
        }
    
        // =========================
        // USER FEEDBACK
        // =========================
        if (assignment?.type === 'coding') {
          if (submissionData.resultStatus === 'success') {
            alert('Submission result: Success - All tests passed');
          } else if (submissionData.resultStatus === 'partial') {
            alert(`Submission result: Partial - ${submissionData.testSummary?.passCount || 0}/${submissionData.testSummary?.totalCount || 0} tests passed`);
          } else {
            alert('Submission result: Fail - 0 tests passed or compiler error');
          }
        } else {
          const scorePct = typeof submissionData.autoScore === 'number'
            ? `${submissionData.autoScore}%`
            : 'N/A';
          alert(`Assignment submitted! MCQ Score: ${scorePct}`);
        }
    
        router.push(queryInternshipId && queryCourseId ? `/internships/${queryInternshipId}/courses/${queryCourseId}` : `/courses/${urlSlug}`);
      } catch (error) {
        console.error("Error submitting assignment:", error);
        alert("Error submitting assignment. Please try again.");
      } finally {
        setSubmitting(false);
      }
    };
    

    const handleReview = () => {
      setShowConfirmDialog(false);
    };

    const runSampleTestsForQuestion = async (questionIndex, question) => {
      if (!submission.codingSolution || submission.codingSolution.trim() === '') {
        alert('Please write some code before running tests.');
        return;
      }

      const testCases = question.testCases || [];
      if (testCases.length === 0) {
        alert('No test cases available for this question.');
        return;
      }

      try {
        setRunningSampleTests(prev => ({ ...prev, [questionIndex]: true }));
        
        const results = [];
        let passCount = 0;
        
        for (const tc of testCases) {
          try {
            const res = await fetch('/api/compile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                language: submission.language,
                source: submission.codingSolution,
                stdin: transformForCompiler(tc.input), // Transform input for compiler
              }),
            });
            
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const data = await res.json();
            const actual = (data.stdout || '').trim();
            const expected = (tc.expectedOutput || tc.output || '').trim();
            const stderr = (data.stderr || '').trim();
            const passed = actual.toLowerCase() === expected.toLowerCase();
            
            if (passed) passCount += 1;
            
            results.push({
              input: tc.input,
              expectedOutput: expected,
              actualOutput: actual,
              stderr: stderr,
              passed: passed,
              error: null
            });
          } catch (err) {
            results.push({
              input: tc.input,
              expectedOutput: tc.expectedOutput || tc.output || '',
              actualOutput: '',
              stderr: '',
              passed: false,
              error: err.message || 'Test execution failed'
            });
          }
        }
        
        setSampleTestResults(prev => ({
          ...prev,
          [questionIndex]: {
            results,
            passCount,
            totalCount: testCases.length
          }
        }));
        
        alert(`Sample Tests: ${passCount}/${testCases.length} passed`);
      } catch (e) {
        console.error('Sample tests run failed:', e);
        alert('Failed to run sample tests. Please try again.');
      } finally {
        setRunningSampleTests(prev => ({ ...prev, [questionIndex]: false }));
      }
    };

    // getDefaultStarter and mapLanguage are hoisted as stateless helpers above

    const backToCourseUrl = queryInternshipId && queryCourseId
      ? `/internships/${queryInternshipId}/courses/${queryCourseId}`
      : `/courses/${urlSlug}`;

    if (loading) return <div className="p-8">Loading assignment...</div>;
    if (!assignment) return <div className="p-8">Assignment not found.</div>;
    if (!hasAccess) return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            You don&apos;t have access to this assignment yet. Please complete the previous chapters first.
          </p>
          <button
            onClick={() => router.push(backToCourseUrl)}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
          >
            Back to Course
          </button>
        </div>
      </div>
    );

    return (
      <CheckAuth>
        <div className=" bg-gradient-to-b from-sky-100 via-blue-50 to-cyan-100 text-gray-800 p-4 sm:p-6">
          <div className=" mx-auto">
            {/* Header */}
            <div className="mb-8">
              <button
                onClick={() => router.push(backToCourseUrl)}
                className="flex items-center gap-2 text-cyan-600 hover:text-cyan-700 mb-4"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Course
              </button>
              
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">{assignment.title}</h1>
                <span className="px-2 py-1 text-xs rounded-full bg-cyan-100 text-cyan-800">
                  {assignment.type === 'mcq' ? 'MCQ' : 'Coding'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2"/></svg>
                  Day {assignment.day || 1}
                </span>
                <span className="inline-flex items-center gap-1">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3M3 11h18M5 19h14"/></svg>
                  Due: {assignment.dueDate || '—'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z"/></svg>
                  Course: {course?.title}
                </span>
              </div>
              
              {/* Progress Indicator */}
              {(() => {
                const { answered, total } = answeredProgress;
                const progressPercentage = total > 0 ? (answered / total) * 100 : 0;
                return (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-800">
                        Progress: {answered} of {total} questions answered
                      </span>
                      <span className="text-sm text-blue-600">
                        {Math.round(progressPercentage)}%
                      </span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })()}
              
              {/* Submission Status */}
              {existingSubmission && (
                <div className="mt-4 space-y-3">
                  <div className="p-4 rounded-lg border flex flex-wrap items-center justify-between gap-3 "
                    style={{ borderColor: existingSubmission.resultStatus === 'success' ? '#bbf7d0' : existingSubmission.resultStatus === 'partial' ? '#fef08a' : '#fecaca', background: existingSubmission.resultStatus === 'success' ? '#f0fdf4' : existingSubmission.resultStatus === 'partial' ? '#fefce8' : '#fef2f2' }}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        existingSubmission.resultStatus === 'success' ? 'bg-green-100 text-green-800' : existingSubmission.resultStatus === 'partial' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {existingSubmission.resultStatus === 'success' ? 'Success' : existingSubmission.resultStatus === 'partial' ? 'Partial' : 'Fail'}
                      </span>
                      <p className={`font-medium ${existingSubmission.resultStatus === 'success' ? 'text-green-800' : existingSubmission.resultStatus === 'partial' ? 'text-yellow-800' : 'text-red-800'}`}>
                        Submitted on {existingSubmission.submittedAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                      </p>
                    </div>
                    {typeof existingSubmission.autoScore === 'number' && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">Auto Score</span>
                        <span className="text-sm font-semibold text-gray-900">{existingSubmission.autoScore}%</span>
                      </div>
                    )}
                    {existingSubmission.testSummary?.partialScore !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">Detailed Score</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {Math.round(existingSubmission.testSummary.partialScore * 100) / 100} / {existingSubmission.testSummary.maxScore}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* MCQ Evaluation Summary - Show for all MCQ questions */}
                  {assignment?.type === 'mcq' && assignment?.questions && existingSubmission && (
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                      <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        MCQ Evaluation Summary
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {assignment.questions.map((q, qIdx) => {
                          const userAnswer = submission.mcqAnswers[qIdx];
                          const hasMultipleAnswers = Array.isArray(q.correctAnswers) && q.correctAnswers.length > 1;
                          
                          // Calculate score for this question
                          let questionScore = 0;
                          let maxScore = 1;
                          let correctSelections = 0;
                          let wrongSelections = 0;
                          let isFullyCorrect = false;
                          
                          if (Array.isArray(q.correctAnswers)) {
                            const totalCorrectOptions = q.correctAnswers.length;
                            if (Array.isArray(userAnswer) && userAnswer.length > 0) {
                              for (const selectedIndex of userAnswer) {
                                if (q.correctAnswers.includes(selectedIndex)) {
                                  correctSelections++;
                                } else {
                                  wrongSelections++;
                                }
                              }
                              questionScore = Math.max(0, (correctSelections - wrongSelections) / totalCorrectOptions);
                              isFullyCorrect = correctSelections === totalCorrectOptions && wrongSelections === 0 && userAnswer.length === totalCorrectOptions;
                            }
                          } else if (typeof q.correctAnswer === 'number') {
                            isFullyCorrect = userAnswer === q.correctAnswer;
                            questionScore = isFullyCorrect ? 1 : 0;
                            correctSelections = isFullyCorrect ? 1 : 0;
                            wrongSelections = !isFullyCorrect && userAnswer !== undefined ? 1 : 0;
                          }
                          
                          const scorePercentage = Math.round(questionScore * 100);
                          
                          return (
                            <div
                              key={qIdx}
                              className={`p-3 rounded-lg border-2 ${
                                isFullyCorrect
                                  ? 'bg-green-50 border-green-300'
                                  : questionScore > 0
                                  ? 'bg-yellow-50 border-yellow-300'
                                  : 'bg-red-50 border-red-300'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-gray-800">
                                  Q{qIdx + 1}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  isFullyCorrect
                                    ? 'bg-green-200 text-green-800'
                                    : questionScore > 0
                                    ? 'bg-yellow-200 text-yellow-800'
                                    : 'bg-red-200 text-red-800'
                                }`}>
                                  {scorePercentage}%
                                </span>
                              </div>
                              <div className="text-xs text-gray-600 space-y-1">
                                <div className="flex justify-between">
                                  <span>Correct:</span>
                                  <span className="font-medium text-green-700">{correctSelections}</span>
                                </div>
                                {wrongSelections > 0 && (
                                  <div className="flex justify-between">
                                    <span>Wrong:</span>
                                    <span className="font-medium text-red-700">{wrongSelections}</span>
                                  </div>
                                )}
                                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full ${
                                      isFullyCorrect ? 'bg-green-600' : questionScore > 0 ? 'bg-yellow-600' : 'bg-red-600'
                                    }`}
                                    style={{ width: `${scorePercentage}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {assignment.questions.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-blue-200">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-700">Overall Performance:</span>
                            <span className={`font-bold ${
                              existingSubmission.resultStatus === 'success' ? 'text-green-700' :
                              existingSubmission.resultStatus === 'partial' ? 'text-yellow-700' :
                              'text-red-700'
                            }`}>
                              {existingSubmission.autoScore !== undefined ? `${existingSubmission.autoScore}%` : 'N/A'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Assignment Content */}
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
                <div className="lg:col-span-4 order-2 lg:order-1">
              {assignment.type === 'mcq' ? (
                // MCQ Assignment - Single question view
                <div>
                  <h2 className="text-lg sm:text-2xl font-semibold mb-4 sm:mb-6 text-cyan-600">Multiple Choice Questions</h2>
                  {assignment.questions && (() => {
                    const qIndex = activeQuestion ?? 0;
                    const question = assignment.questions[qIndex];
                    if (!question) return null;
                    const hasMultipleAnswers = Array.isArray(question.correctAnswers) && question.correctAnswers.length > 1;
                    const userAnswer = submission.mcqAnswers[qIndex];
                    return (
                      <div key={qIndex} className="mb-6 sm:mb-8 p-4 sm:p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
                        <div className="mb-4">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">Question {qIndex + 1}</h3>
                          <p className="text-sm sm:text-base text-gray-700 leading-6 sm:leading-relaxed">{question.question}</p>
                        </div>
                        {(question.description || question.explanation) && (question.description || question.explanation).trim() && (
                          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                            <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2 text-sm sm:text-base">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              Description
                            </h4>
                            <div className="text-blue-700 text-sm sm:text-base leading-6 sm:leading-relaxed whitespace-pre-wrap">{question.description || question.explanation}</div>
                          </div>
                        )}
                        {hasMultipleAnswers && (
                          <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-xs sm:text-sm text-yellow-800 font-medium flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              Select all correct answers (multiple choice)
                            </p>
                          </div>
                        )}
                        <div className="space-y-3">
                          <h4 className="font-medium text-gray-800 mb-2 sm:mb-3 text-sm sm:text-base">Options:</h4>
                          {question.options.map((option, oIndex) => {
                            const isChecked = hasMultipleAnswers ? (Array.isArray(userAnswer) && userAnswer.includes(oIndex)) : (userAnswer === oIndex);
                            const isCorrectOption = hasMultipleAnswers ? (Array.isArray(question.correctAnswers) && question.correctAnswers.includes(oIndex)) : (question.correctAnswer === oIndex);
                            const userSelected = isChecked;
                            let optionStyle = '';
                            let iconElement = null;
                            if (existingSubmission) {
                              if (isCorrectOption && userSelected) { optionStyle = 'bg-green-50 border-green-400 shadow-sm'; iconElement = (<span className="text-green-600 font-bold text-lg">✓</span>); }
                              else if (isCorrectOption && !userSelected) { optionStyle = 'bg-green-100 border-green-300'; iconElement = (<span className="text-green-600 font-bold text-lg">✓</span>); }
                              else if (!isCorrectOption && userSelected) { optionStyle = 'bg-red-50 border-red-400 shadow-sm'; iconElement = (<span className="text-red-600 font-bold text-lg">✗</span>); }
                              else { optionStyle = 'bg-gray-50 border-gray-300'; }
                            } else {
                              optionStyle = isChecked ? 'bg-cyan-50 border-cyan-400 shadow-sm' : 'bg-white border-gray-300 hover:border-cyan-300 hover:bg-cyan-25';
                            }
                            return (
                              <label key={oIndex} className={`block p-3 sm:p-4 rounded-lg border-2 transition-all cursor-pointer ${optionStyle}`}>
                                <div className="flex items-center space-x-3 sm:space-x-4">
                                  <input
                                    type={hasMultipleAnswers ? 'checkbox' : 'radio'}
                                    name={hasMultipleAnswers ? undefined : `question-${qIndex}`}
                                    value={oIndex}
                                    checked={isChecked}
                                    onChange={existingSubmission ? undefined : () => handleMCQAnswer(qIndex, oIndex)}
                                    disabled={existingSubmission}
                                    className={`${hasMultipleAnswers ? 'w-4 h-4 sm:w-5 sm:h-5 rounded' : 'w-4 h-4 sm:w-5 sm:h-5'} text-cyan-600 focus:ring-cyan-500 focus:ring-2 ${existingSubmission ? 'opacity-50' : ''}`}
                                  />
                                  <span className={`text-gray-700 font-medium flex-1 text-sm sm:text-base ${existingSubmission ? 'opacity-75' : ''}`}>{String.fromCharCode(65 + oIndex)}. {option}</span>
                                  {iconElement}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        {existingSubmission && (
                          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <h5 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              Correct Answer{Array.isArray(question.correctAnswers) && question.correctAnswers.length > 1 ? 's' : ''}
                            </h5>
                            <div className="text-sm text-green-700">
                              {Array.isArray(question.correctAnswers) ? (
                                <div>
                                  <p className="mb-2">The correct answer{question.correctAnswers.length > 1 ? 's are' : ' is'}:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {question.correctAnswers.map((correctIndex, idx) => (
                                      <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-200 text-green-800">
                                        {String.fromCharCode(65 + correctIndex)}. {question.options[correctIndex]}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : typeof question.correctAnswer === 'number' ? (
                                <div>
                                  <p className="mb-2">The correct answer is:</p>
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-200 text-green-800">
                                    {String.fromCharCode(65 + question.correctAnswer)}. {question.options[question.correctAnswer]}
                                  </span>
                                </div>
                              ) : (
                                <p className="text-gray-600">No correct answer defined</p>
                              )}
                            </div>
                          </div>
                        )}
                        {/* Detailed Evaluation and Score Breakdown */}
                        {existingSubmission && (
                          <div className="mt-4 space-y-3">
                            {/* Score Breakdown */}
                            {(() => {
                              const userAnswer = submission.mcqAnswers[qIndex];
                              let questionScore = 0;
                              let maxScore = 1;
                              let correctSelections = 0;
                              let wrongSelections = 0;
                              let totalCorrectOptions = 0;
                              let isFullyCorrect = false;
                              
                              // Calculate score for multiple choice
                              if (Array.isArray(question.correctAnswers)) {
                                totalCorrectOptions = question.correctAnswers.length;
                                if (Array.isArray(userAnswer) && userAnswer.length > 0) {
                                  for (const selectedIndex of userAnswer) {
                                    if (question.correctAnswers.includes(selectedIndex)) {
                                      correctSelections++;
                                    } else {
                                      wrongSelections++;
                                    }
                                  }
                                  questionScore = Math.max(0, (correctSelections - wrongSelections) / totalCorrectOptions);
                                  isFullyCorrect = correctSelections === totalCorrectOptions && wrongSelections === 0 && userAnswer.length === totalCorrectOptions;
                                }
                              } else if (typeof question.correctAnswer === 'number') {
                                totalCorrectOptions = 1;
                                isFullyCorrect = userAnswer === question.correctAnswer;
                                questionScore = isFullyCorrect ? 1 : 0;
                                correctSelections = isFullyCorrect ? 1 : 0;
                                wrongSelections = !isFullyCorrect && userAnswer !== undefined && userAnswer !== null ? 1 : 0;
                              }
                              
                              const scorePercentage = Math.round(questionScore * 100);
                              
                              return (
                                <div className={`p-4 rounded-lg border-2 ${
                                  isFullyCorrect
                                    ? 'bg-green-50 border-green-300'
                                    : questionScore > 0
                                    ? 'bg-yellow-50 border-yellow-300'
                                    : 'bg-red-50 border-red-300'
                                }`}>
                                  <h5 className="font-semibold mb-3 flex items-center gap-2" style={{
                                    color: isFullyCorrect ? '#166534' : questionScore > 0 ? '#854d0e' : '#991b1b'
                                  }}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    Question Evaluation
                                  </h5>
                                  
                                  <div className="space-y-3">
                                    {/* Score Display */}
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium" style={{
                                        color: isFullyCorrect ? '#166534' : questionScore > 0 ? '#854d0e' : '#991b1b'
                                      }}>
                                        Your Score:
                                      </span>
                                      <span className={`text-lg font-bold ${
                                        isFullyCorrect ? 'text-green-700' : questionScore > 0 ? 'text-yellow-700' : 'text-red-700'
                                      }`}>
                                        {scorePercentage}%
                                      </span>
                                    </div>
                                    
                                    {/* Progress Bar */}
                                    <div className="w-full bg-gray-200 rounded-full h-3">
                                      <div
                                        className={`h-3 rounded-full transition-all duration-300 ${
                                          isFullyCorrect ? 'bg-green-600' : questionScore > 0 ? 'bg-yellow-600' : 'bg-red-600'
                                        }`}
                                        style={{ width: `${scorePercentage}%` }}
                                      />
                                    </div>
                                    
                                    {/* Detailed Breakdown */}
                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t" style={{
                                      borderColor: isFullyCorrect ? '#86efac' : questionScore > 0 ? '#fde047' : '#fca5a5'
                                    }}>
                                      <div className="text-xs">
                                        <span className="font-medium text-gray-600">Correct selections:</span>
                                        <span className="ml-2 font-bold text-green-700">{correctSelections}</span>
                                      </div>
                                      {wrongSelections > 0 && (
                                        <div className="text-xs">
                                          <span className="font-medium text-gray-600">Wrong selections:</span>
                                          <span className="ml-2 font-bold text-red-700">{wrongSelections}</span>
                                        </div>
                                      )}
                                      <div className="text-xs col-span-2">
                                        <span className="font-medium text-gray-600">Total correct options:</span>
                                        <span className="ml-2 font-bold text-gray-800">{totalCorrectOptions}</span>
                                      </div>
                                    </div>
                                    
                                    {/* Status Message */}
                                    <div className={`text-xs font-medium p-2 rounded ${
                                      isFullyCorrect
                                        ? 'bg-green-100 text-green-800'
                                        : questionScore > 0
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}>
                                      {isFullyCorrect
                                        ? '✓ Perfect! All correct answers selected.'
                                        : questionScore > 0
                                        ? '⚠ Partial credit awarded.'
                                        : '✗ No correct answers selected.'}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                            
                            {/* Explanation if available */}
                            {question.explanation && (
                              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <h6 className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Explanation
                                </h6>
                                <p className="text-xs text-blue-700 whitespace-pre-wrap">{question.explanation}</p>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="mt-4 sm:mt-6 flex flex-wrap items-center gap-2">
                          <button onClick={() => toggleReview(qIndex)} className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium shadow border ${reviewFlags[qIndex] ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-50'}`}>{reviewFlags[qIndex] ? 'Unmark Review' : 'Mark for Review'}</button>
                          <div className="ml-auto flex items-center gap-2">
                            <button onClick={() => scrollToQuestion(Math.max(0, qIndex - 1))} disabled={qIndex === 0} className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium border ${qIndex === 0 ? 'bg-gray-200 text-gray-500 border-gray-300' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'}`}>Previous</button>
                            {!existingSubmission && (<button onClick={() => clearAnswer(qIndex)} className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium border bg-white text-red-700 border-red-300 hover:bg-red-50">Clear</button>)}
                            <button onClick={() => scrollToQuestion(Math.min((assignment.questions?.length || 1) - 1, qIndex + 1))} disabled={qIndex === (assignment.questions?.length || 1) - 1} className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium border ${qIndex === (assignment.questions?.length || 1) - 1 ? 'bg-gray-200 text-gray-500 border-gray-300' : 'bg-cyan-600 text-white border-cyan-600 hover:bg-cyan-700'}`}>Next</button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                // Coding Assignment - Single question view
                <div>
                  <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h2 className="text-lg sm:text-2xl font-semibold text-cyan-600">Coding Assignment</h2>
                    <div className="flex items-center gap-3">
                      {editorDark ? (
                        <svg className="w-4 h-4 text-slate-800" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <circle cx="12" cy="12" r="4" strokeWidth="2" />
                          <path strokeLinecap="round" strokeWidth="2" d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" />
                        </svg>
                      )}
                      <span className="text-xs sm:text-sm font-medium text-slate-700">{editorDark ? 'Dark' : 'Light'}</span>
                      <button
                        type="button"
                        onClick={() => setEditorDark((d) => !d)}
                        role="switch"
                        aria-checked={editorDark}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editorDark ? 'bg-slate-800' : 'bg-slate-300'}`}
                        aria-label="Toggle editor dark mode"
                      >
                        <span className="sr-only">Toggle editor theme</span>
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${editorDark ? 'translate-x-5' : 'translate-x-1'}`}></span>
                      </button>
                      {hiddenStats && (
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              hiddenStats.passCount === hiddenStats.totalCount
                                ? 'bg-green-100 text-green-800'
                                : hiddenStats.passCount === 0
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {hiddenStats.passCount}/{hiddenStats.totalCount} tests passed
                          </span>
                          <div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`${
                                hiddenStats.passCount === hiddenStats.totalCount ? 'bg-green-600' : 'bg-yellow-500'
                              } h-2`}
                              style={{ width: `${Math.round((hiddenStats.passCount / hiddenStats.totalCount) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Problem Description */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                  {assignment.questions && (() => {
                    const qIndex = activeQuestion ?? 0;
                    const question = assignment.questions[qIndex];
                    if (!question) return null;
                    return (
                    <div key={qIndex} className="mb-6 p-4 sm:p-5 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-base sm:text-lg font-semibold">Problem {qIndex + 1}</h3>
                        <span className="text-xs text-gray-500">Test cases: {question.testCases?.length || 0}</span>
                      </div>
                      <div className="text-gray-700 mb-4 text-sm sm:text-base leading-6 sm:leading-7 whitespace-pre-wrap">{question.question}</div>
                      {question.description && (
                        <div className="mb-4 p-3 bg-white rounded border">
                          <h4 className="font-medium text-gray-800 font-semibold mb-2">Description</h4>
                          <div className="text-gray-700 leading-7 whitespace-pre-wrap">{question.description}</div>
                        </div>
                      )}
                      {question.testCases && question.testCases.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-800">Sample Test Cases</h4>
                            {!existingSubmission && (
                              <button
                                onClick={() => runSampleTestsForQuestion(qIndex, question)}
                                disabled={runningSampleTests[qIndex]}
                                className="px-3 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 text-white rounded-md shadow"
                              >
                                {runningSampleTests[qIndex] ? 'Running...' : 'Run Tests'}
                              </button>
                            )}
                          </div>
                          <div className="grid sm:grid-cols-2 gap-2 mb-4">
                            {question.testCases.map((testCase, tIndex) => (
                              <div key={tIndex} className="text-sm bg-white p-3 rounded border">
                                <p className="font-medium text-gray-800 font-semibold mb-1">Input</p>
                                <div className="bg-gray-100 rounded p-2 overflow-x-auto text-gray-700 whitespace-pre-wrap font-mono">{transformForDisplay(testCase.input)}</div>
                                <p className="font-medium text-gray-800 font-semibold mt-2 mb-1">Expected Output</p>
                                <div className="bg-gray-100 rounded p-2 overflow-x-auto text-gray-700 whitespace-pre-wrap font-mono">{transformForDisplay(testCase.expectedOutput || testCase.output)}</div>
                              </div>
                            ))}
                          </div>

                          {/* Display Sample Test Results */}
                          {sampleTestResults[qIndex] && (
                            <div className="mt-4">
                              <div className="flex items-center gap-3 mb-3">
                                <h5 className="font-semibold text-gray-800">Test Results</h5>
                                <span
                                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                    sampleTestResults[qIndex].passCount === sampleTestResults[qIndex].totalCount
                                      ? 'bg-green-100 text-green-800'
                                      : sampleTestResults[qIndex].passCount === 0
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  {sampleTestResults[qIndex].passCount}/{sampleTestResults[qIndex].totalCount} passed
                                </span>
                              </div>
                              <div className="space-y-3">
                                {sampleTestResults[qIndex].results.map((result, rIndex) => (
                                  <div
                                    key={rIndex}
                                    className={`p-3 rounded-lg border-2 ${
                                      result.passed
                                        ? 'bg-green-50 border-green-300'
                                        : 'bg-red-50 border-red-300'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-semibold text-gray-800">
                                        Test Case {rIndex + 1}
                                      </span>
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                          result.passed
                                            ? 'bg-green-200 text-green-800'
                                            : 'bg-red-200 text-red-800'
                                        }`}
                                      >
                                        {result.passed ? '✓ PASSED' : '✗ FAILED'}
                                      </span>
                                    </div>

                                    <div className="grid gap-2 text-xs">
                                      {/* Input */}
                                      <div>
                                        <p className="font-medium text-gray-700 mb-1">Input:</p>
                                        <div className="bg-white border border-gray-300 rounded p-2 overflow-x-auto text-gray-800 whitespace-pre-wrap font-mono">
                                          {transformForDisplay(result.input || '(empty)')}
                                        </div>
                                      </div>

                                      {/* Expected Output */}
                                      <div>
                                        <p className="font-medium text-gray-700 mb-1">Expected Output:</p>
                                        <div className="bg-white border border-gray-300 rounded p-2 overflow-x-auto text-gray-800 whitespace-pre-wrap font-mono">
                                          {transformForDisplay(result.expectedOutput || '(empty)')}
                                        </div>
                                      </div>

                                      {/* Actual Output */}
                                      <div>
                                        <p className="font-medium text-gray-700 mb-1">Your Output:</p>
                                        <div
                                          className={`bg-white border rounded p-2 overflow-x-auto whitespace-pre-wrap font-mono ${
                                            result.passed
                                              ? 'border-green-300 text-gray-800'
                                              : 'border-red-300 text-red-800'
                                          }`}
                                        >
                                          {transformForDisplay(result.actualOutput || '(empty)')}
                                        </div>
                                      </div>

                                      {/* Error or stderr if present */}
                                      {(result.error || result.stderr) && (
                                        <div>
                                          <p className="font-medium text-red-700 mb-1">
                                            {result.error ? 'Error:' : 'Standard Error:'}
                                          </p>
                                          <pre className="bg-red-100 border border-red-300 rounded p-2 overflow-x-auto text-red-800">
                                            {result.error || result.stderr}
                                          </pre>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Per-question navigation controls */}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                              <button
                          onClick={() => scrollToQuestion(Math.max(0, qIndex - 1))}
                          disabled={qIndex === 0}
                                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium border ${qIndex === 0 ? 'bg-gray-200 text-gray-500 border-gray-300' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'}`}
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => scrollToQuestion(Math.min((assignment.questions?.length || 1) - 1, qIndex + 1))}
                          disabled={qIndex === (assignment.questions?.length || 1) - 1}
                                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium border ${qIndex === (assignment.questions?.length || 1) - 1 ? 'bg-gray-200 text-gray-500 border-gray-300' : 'bg-cyan-600 text-white border-cyan-600 hover:bg-cyan-700'}`}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  );})()}

                    </div>
                    {/* Language Selection */}
                    <div>
                  <div className="mb-4">
                    <label className="block font-semibold text-sm font-medium text-gray-700 mb-2">
                      Programming Language:
                    </label>
                    <select
                      value={submission.language}
                      onChange={existingSubmission ? undefined : (e) => handleLanguageChange(e.target.value)}
                      disabled={existingSubmission}
                      className={`w-full p-2 border border-gray-300 rounded-md focus:ring-cyan-500 focus:border-cyan-500 ${existingSubmission ? 'bg-gray-100 opacity-75' : ''}`}
                    >
                      <option value="cpp">C++</option>
                      <option value="javascript">JavaScript</option>
                      <option value="python">Python</option>
                      <option value="java">Java</option>
                      <option value="c">C</option>
                      <option value="r">R</option>
                      <option value="mysql">MySQL</option>
                      <option value="sql">SQL (SQLite)</option>
                    </select>
                  </div>

                  {/* Code Editor */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {existingSubmission ? 'Your Submitted Solution:' : 'Your Solution:'}
                    </label>
                    <div className={`border rounded-lg overflow-hidden shadow-sm ${editorDark ? 'border-slate-700 bg-slate-900' : ''}`}>
                      <MonacoEditor
                        height="400px"
                        language={mapLanguage(submission.language)}
                        value={submission.codingSolution || getDefaultStarter(submission.language)}
                        onChange={existingSubmission ? undefined : handleCodingChange}
                        options={{
                          fontSize: 14,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          readOnly: existingSubmission,
                        }}
                        theme={editorDark ? 'vs-dark' : 'light'}
                      />
                    </div>
                  </div>

                  {/* Run Hidden Tests (no details shown) */}
                  {!existingSubmission && (
                    <div className="mb-6 flex flex-wrap items-center gap-3">
                      <button
                        onClick={async () => {
                          if (!submission.codingSolution || submission.codingSolution.trim() === '') {
                            alert('Please write some code before running tests.');
                            return;
                          }
                          try {
                            setRunningHidden(true);
                            setHiddenSummary(null);
                            setTestResults([]);
                            // Collect test cases across all coding questions
                            const allTestCases = (assignment.questions || [])
                              .flatMap((q) => Array.isArray(q.testCases) ? q.testCases : [])
                              .filter(Boolean);
                            // Detect hidden by multiple conventions
                            const hiddenTests = allTestCases.filter((tc) => tc && (tc.hidden === true || tc.isHidden === true || tc.visibility === 'hidden'));
                            const testsToRun = hiddenTests.length > 0 ? hiddenTests : allTestCases;
                            if (testsToRun.length === 0) {
                              alert('No tests configured.');
                              setRunningHidden(false);
                              return;
                            }
                            let passCount = 0;
                            const results = [];
                            for (const tc of testsToRun) {
                              try {
                                const res = await fetch('/api/compile', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    language: submission.language,
                                    source: submission.codingSolution,
                                    stdin: transformForCompiler(tc.input), // Transform input for compiler
                                  }),
                                });
                                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                                const data = await res.json();
                                const actual = (data.stdout || '').trim();
                                const expected = (tc.expectedOutput || tc.output || '').trim();
                                const stderr = (data.stderr || '').trim();
                                const passed = actual.toLowerCase() === expected.toLowerCase();
                                if (passed) passCount += 1;
                                
                                // Store result details
                                results.push({
                                  input: tc.input,
                                  expectedOutput: expected,
                                  actualOutput: actual,
                                  stderr: stderr,
                                  passed: passed,
                                  error: null
                                });
                              } catch (err) {
                                // Treat error as failed test
                                results.push({
                                  input: tc.input,
                                  expectedOutput: tc.expectedOutput || tc.output || '',
                                  actualOutput: '',
                                  stderr: '',
                                  passed: false,
                                  error: err.message || 'Test execution failed'
                                });
                              }
                            }
                            const label = hiddenTests.length > 0 ? 'hidden tests' : 'tests';
                            const summary = `${passCount}/${testsToRun.length} ${label} passed`;
                            setHiddenSummary(summary);
                            setHiddenStats({ passCount, totalCount: testsToRun.length });
                            setTestResults(results);
                            alert(summary);
                          } catch (e) {
                            console.error('Hidden tests run failed:', e);
                            alert('Failed to run hidden tests. Please try again.');
                          } finally {
                            setRunningHidden(false);
                          }
                        }}
                        disabled={runningHidden}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md shadow"
                      >
                        {runningHidden ? 'Running Hidden Tests...' : 'Run Hidden Tests'}
                      </button>
                      {hiddenStats && (
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              hiddenStats.passCount === hiddenStats.totalCount
                                ? 'bg-green-100 text-green-800'
                                : hiddenStats.passCount === 0
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {hiddenStats.passCount}/{hiddenStats.totalCount} tests passed
                          </span>
                          <div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`${
                                hiddenStats.passCount === hiddenStats.totalCount
                                  ? 'bg-green-600'
                                  : 'bg-yellow-500'
                              } h-2`}
                              style={{ width: `${Math.round((hiddenStats.passCount / hiddenStats.totalCount) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Test Results Display */}
                  {testResults.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold mb-4 text-gray-800">Test Results</h3>
                      <div className="space-y-4">
                        {testResults.map((result, index) => (
                          <div
                            key={index}
                            className={`p-4 rounded-lg border-2 ${
                              result.passed
                                ? 'bg-green-50 border-green-300'
                                : 'bg-red-50 border-red-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-gray-800">
                                Test Case {index + 1}
                              </h4>
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  result.passed
                                    ? 'bg-green-200 text-green-800'
                                    : 'bg-red-200 text-red-800'
                                }`}
                              >
                                {result.passed ? '✓ PASSED' : '✗ FAILED'}
                              </span>
                            </div>

                            <div className="grid gap-3">
                              {/* Input */}
                              <div>
                                <p className="text-sm font-medium text-gray-700 mb-1">Input:</p>
                                <div className="bg-white border border-gray-300 rounded p-2 text-sm overflow-x-auto text-gray-800 whitespace-pre-wrap font-mono">
                                  {transformForDisplay(result.input || '(empty)')}
                                </div>
                              </div>

                              {/* Expected Output */}
                              <div>
                                <p className="text-sm font-medium text-gray-700 mb-1">Expected Output:</p>
                                <div className="bg-white border border-gray-300 rounded p-2 text-sm overflow-x-auto text-gray-800 whitespace-pre-wrap font-mono">
                                  {transformForDisplay(result.expectedOutput || '(empty)')}
                                </div>
                              </div>

                              {/* Actual Output */}
                              <div>
                                <p className="text-sm font-medium text-gray-700 mb-1">Your Output:</p>
                                <div
                                  className={`bg-white border rounded p-2 text-sm overflow-x-auto whitespace-pre-wrap font-mono ${
                                    result.passed
                                      ? 'border-green-300 text-gray-800'
                                      : 'border-red-300 text-red-800'
                                  }`}
                                >
                                  {transformForDisplay(result.actualOutput || '(empty)')}
                                </div>
                              </div>

                              {/* Error or stderr if present */}
                              {(result.error || result.stderr) && (
                                <div>
                                  <p className="text-sm font-medium text-red-700 mb-1">
                                    {result.error ? 'Error:' : 'Standard Error:'}
                                  </p>
                                  <pre className="bg-red-100 border border-red-300 rounded p-2 text-sm overflow-x-auto text-red-800">
                                    {result.error || result.stderr}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                    </div>
                  </div>
                </div>
              )}
                </div>
                <aside className="lg:col-span-1 order-1 lg:order-2">
                  {assignment.questions && assignment.questions.length > 0 && (
                    <div className="sticky top-2 sm:top-24">
                      <div className="w-full bg-white/95 backdrop-blur border border-gray-200 rounded-lg shadow p-3 sm:p-4">
                        {timeLeftMs !== null && (
                          <div className="mb-4">
                            <div className="text-xs sm:text-sm font-semibold text-gray-800 mb-1">Time Left</div>
                            {(() => {
                              const t = formatTime(timeLeftMs);
                              if (!t) return null;
                              return (
                                <div className="flex items-center gap-1.5 sm:gap-2 text-center">
                                  <div className="flex-1 p-1.5 sm:p-2 rounded bg-gray-100 font-semibold text-xs sm:text-sm">{t.h}</div>
                                  <span className="font-bold">:</span>
                                  <div className="flex-1 p-1.5 sm:p-2 rounded bg-gray-100 font-semibold text-xs sm:text-sm">{t.m}</div>
                                  <span className="font-bold">:</span>
                                  <div className="flex-1 p-1.5 sm:p-2 rounded bg-gray-100 font-semibold text-xs sm:text-sm">{t.s}</div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        <div className="mb-3">
                          <div className="text-xs sm:text-sm font-semibold text-gray-800 mb-2">Questions</div>
                          <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                            {assignment.questions.map((_, idx) => {
                              const userAnswer = submission.mcqAnswers[idx];
                              const isAnswered = Array.isArray(userAnswer) ? userAnswer.length > 0 : userAnswer !== undefined && userAnswer !== null;
                              const isCurrent = activeQuestion === idx;
                              const isMarked = reviewFlags[idx];
                              const isVisited = visitedMap[idx];
                              let cls = 'bg-gray-200 text-gray-800';
                              if (isVisited && !isAnswered && !isMarked) cls = 'bg-red-500 text-white';
                              if (isAnswered) cls = 'bg-green-500 text-white';
                              if (isMarked) cls = 'bg-purple-500 text-white';
                              if (isCurrent) cls = 'bg-cyan-600 text-white';
                              return (
                                <button key={idx} onClick={() => scrollToQuestion(idx)} className={`${cls} rounded-md text-[11px] sm:text-xs font-semibold py-1 px-1`} aria-label={`Go to question ${idx + 1}`} title={`Question ${idx + 1}`}>{idx + 1}</button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-2"><span className="w-3 h-3 bg-cyan-600 inline-block rounded"></span>Current</div>
                          <div className="flex items-center gap-2"><span className="w-3 h-3 bg-gray-300 inline-block rounded"></span>Not Attempted</div>
                          <div className="flex items-center gap-2"><span className="w-3 h-3 bg-green-500 inline-block rounded"></span>Answered</div>
                          <div className="flex items-center gap-2"><span className="w-3 h-3 bg-red-500 inline-block rounded"></span>Not Answered</div>
                          <div className="flex items-center gap-2"><span className="w-3 h-3 bg-purple-500 inline-block rounded"></span>Marked</div>
                        </div>
                      </div>
                    </div>
                  )}
                </aside>
              </div>
            </div>

            {/* Submit Button - Only show if no existing submission */}
            {!existingSubmission && (
              <div className="flex justify-end">
                <button
                  onClick={handleSubmitClick}
                  disabled={submitting}
                  className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 text-white font-medium rounded-lg shadow-md transition"
                >
                  {submitting ? "Submitting..." : "Submit Assignment"}
                </button>
              </div>
            )}

            {/* Confirmation Dialog */}
            {showConfirmDialog && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h3 className="ml-3 text-lg font-medium text-gray-900">
                      Confirm Submission
                    </h3>
                  </div>
                  
                  <div className="mb-6">
                    <p className="text-sm text-gray-600">
                      <strong>Alert:</strong> Once you submit this assignment, you cannot edit it anymore.
                    </p>
                    
                    {/* Progress Summary */}
                    {(() => {
                      const { answered, total } = answeredProgress;
                      const progressPercentage = total > 0 ? (answered / total) * 100 : 0;
                      return (
                        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">
                              Questions Answered: {answered} out of {total}
                            </span>
                            <span className="text-sm text-gray-600">
                              {Math.round(progressPercentage)}% Complete
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-cyan-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progressPercentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })()}
                    
                    <p className="text-sm text-gray-600 mt-4">
                      Are you sure you want to submit your assignment?
                    </p>
                  </div>
                  
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={handleReview}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                      Review
                    </button>
                    <button
                      onClick={handleConfirmSubmit}
                      disabled={submitting}
                      className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 border border-transparent rounded-md hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:bg-gray-400"
                    >
                      {submitting ? "Submitting..." : "Submit"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CheckAuth>
    );
  }


