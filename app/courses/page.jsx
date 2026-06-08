"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db, firestoreHelpers } from "../../lib/firebase";
import CheckAuth from "../../lib/CheckAuth";
import Image from "next/image";
import { createCourseUrl } from "../../lib/urlUtils";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";


export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [loadedImages, setLoadedImages] = useState(new Set());
  const [imageErrors, setImageErrors] = useState(new Map());

  // Function to generate SEO-optimized alt text and title for images
  const getImageSEOAttributes = (courseTitle) => {
    const courseName = courseTitle.trim();
    return {
      alt: `${courseName} Course Training at VAWE Institute - SkillWins LMS Vijayawada | Best Software Training in Vijayawada`,
      title: `Learn ${courseName} at VAWE Institute - SkillWins LMS | Software Training Courses in Vijayawada`,
    };
  };

  // Function to get the appropriate image based on course title
  const getCourseImage = (courseTitle) => {
    const title = courseTitle.toLowerCase();
    
    // Search Engine Marketing
    if (title.includes('search engine marketing') || title.includes('sem')) {
      return '/assets/SEM.jpg';
    }
    // AI Device Installation Operator
    else if (title.includes('ai device') || title.includes('installation operator') || title.includes('ai devices') || title.includes('al devices')) {
      return '/assets/AI Device Installation Operator.jpg';
    }
    // Aptitude
    else if (title.includes('aptitude')) {
      return '/assets/Aptitude.jpg';
    }
    // C Programming
    else if (title.includes('c programming') || title.includes('c++') || title.includes('c plus plus')) {
      return '/assets/c++.png';
    }
    // C Programming (alternative image)
    else if (title.includes('c language') && !title.includes('c++')) {
      return '/assets/cimage.jpg';
    }
    // Broadband Technician
    else if (title.includes('broadband') || title.includes('technician')) {
      return '/assets/Broadband Technician.jpg';
    }
    // CSS
    else if (title.includes('css') || title.includes('cascading style sheets')) {
      return '/assets/CSS.png';
    }
    // Coding/Programming
    else if (title.includes('coding') || title.includes('programming') || title.includes('code')) {
      return '/assets/codingimage.jpg';
    }
    // Generative AI
    else if (title.includes('generative ai') || title.includes('gen ai') || title.includes('artificial intelligence')) {
      return '/assets/Generative AI.jpg';
    }
    // Data Structures & Algorithms
    else if (title.includes('data structures') || title.includes('algorithms') || title.includes('dsa')) {
      return '/assets/DSA.jpg';
    }
    // JavaScript (must come before Java to avoid conflict)
    else if (title.includes('javascript') || title.includes('js') || title.includes('java script')) {
      return '/assets/javaScript.png';
    }
    // General Duty Assistant
    else if (title.includes('general duty') || title.includes('assistant')) {
      return '/assets/General Duty Assistant.jpg';
    }
    // HTML
    else if (title.includes('html')) {
      return '/assets/HTML (1).png';
    }
    // MongoDB
    else if (title.includes('mongodb') || title.includes('mongo')) {
      return '/assets/Mango DB.png';
    }
    // MySQL
    else if (title.includes('mysql') || title.includes('MY SQL')) {
      return '/assets/Mysql.png';
    }
    // Microsoft
    else if (title.includes('microsoft') || title.includes('office')) {
      return '/assets/Microsoft.webp';
    }
    // Power BI
    else if (title.includes('power bi') || title.includes('powerbi') || title.includes('business intelligence')) {
      return '/assets/Power Bi.png';
    }
    // React
    else if (title.includes('react')) {
      return '/assets/react.jpg';
    }
    // Python Full Stack
    else if (title.includes('python') || title.includes('full stack')) {
      return '/assets/pythonimge.jpeg';
    }
    // R Programming
    else if (title.includes('r programming') || title.includes('r language')) {
      return '/assets/R-Programming.jpg';
    }
    // Django Framework
    else if (title.includes('django') || title.includes('django framework')) {
      return '/assets/Django FrameWork.jpg';
    }
    // Telegram Customer Care Executive
    else if (title.includes('telegram') || title.includes('customer care') || title.includes('executive') || title.includes('telecomm')) {
      return '/assets/Telegram customer care Executive.jpg';
    }
    // Advanced Java
    else if (title.includes('advanced java') || title.includes('java advanced')) {
      return '/assets/Advanced Java.jpg';
    }
    // SQL
    else if (title.includes('sql')) {
      return '/assets/Mysql.png';
    }
    // Machine Learning, Deep Learning
    else if (title.includes('machine learning') || title.includes('deep learning') || title.includes('ml') || title.includes('dl')) {
      return '/assets/ML & DL.jpg';
    }
    // Java (general) - must come after JavaScript
    else if (title.includes('java')) {
      return '/assets/JAVA.jpg';
    }
    // Certificate
    else if (title.includes('crt') || title.includes('certificate')) {
      return '/crtimage.jpeg';
    }
    // Workshop
    else if (title.includes('workshop')) {
      return '/workshopimg.jpg';
    }
    // Default fallback image
    else {
      return '/LmsImg.jpg';
    }
  };

  useEffect(() => {
    async function fetchCourses() {
      try {
        const snap = await firestoreHelpers.getDocs(
          firestoreHelpers.collection(db, "courses")
        );
        const coursesData = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setCourses(coursesData);
        setFilteredCourses(coursesData);
      } catch (err) {
        console.error("❌ Error fetching courses:", err);
      }
    }
    fetchCourses();
  }, []);

  // Filter courses based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredCourses(courses);
    } else {
      const filtered = courses.filter((course) =>
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCourses(filtered);
    }
  }, [searchQuery, courses]);

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  return (
    <CheckAuth>
      <div className="min-h-screen bg-gradient-to-br from-[#fdc377]/30 to-[#00448a]/10 p-4 sm:p-6 lg:p-10">
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-center mb-6 sm:mb-8 lg:mb-10 text-[#00448a] tracking-wide drop-shadow-lg" 
        style={{ fontFamily: '"montserrat"' }}
        >
          Choose your <span className="text-transparent bg-clip-text bg-black drop-shadow-lg">Learning Path</span>
        </h1>
        <p className="hidden md:block text-center text-black mb-6 sm:mb-8 px-4 max-w-3xl mx-auto">
          Explore our comprehensive programming courses designed to help you build a successful career in software development.
        </p>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-8 sm:mb-12 px-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search courses by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-12 py-3 sm:py-4 bg-white/10 backdrop-blur-lg border border-black/50 
                         rounded-xl sm:rounded-2xl text-black placeholder-gray-400 
                         focus:outline-none focus:ring-2 focus:ring-[#26ebe5] focus:border-transparent
                         transition-all duration-300"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-3 text-center text-black text-sm">
              Found {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {courses.length === 0 ? (
          <p className="text-center text-slate-100">No courses available.</p>
        ) : filteredCourses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-black text-lg mb-2">No courses found matching &quot;{searchQuery}&quot;</p>
            <button
              onClick={handleClearSearch}
              className="text-[#26ebe5] hover:opacity-80 underline text-sm"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 items-stretch">
            {filteredCourses.map((course, index) => {
              const imageSrc = getCourseImage(course.title);
              const imageKey = `${course.id}-${imageSrc}`;
              const hasError = imageErrors.has(imageKey);
              const displaySrc = hasError ? '/LmsImg.jpg' : imageSrc;
              const fallbackKey = `${course.id}-/LmsImg.jpg`;
              const isLoaded = loadedImages.has(imageKey) || (hasError && loadedImages.has(fallbackKey));
              const isPriority = index < 2; // Load only first 2 images with priority
              const seoAttributes = getImageSEOAttributes(course.title);
              const fallbackSEO = {
                alt: `VAWE Institute - SkillWins LMS Platform | Best Software Training Institute in Vijayawada`,
                title: `VAWE Institute - SkillWins LMS | Software Training Courses in Vijayawada`,
              };
              const finalSEO = hasError ? fallbackSEO : seoAttributes;
              
              return (
                <div
                  key={course.id}
                  onClick={() => router.push(`/courses/${createCourseUrl(course.title)}`)}
                  className="relative group backdrop-blur-sm bg-white/10 rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden 
                             border border-black/20 shadow-md cursor-pointer 
                             hover:border-[#26ebe5] hover:shadow-[#26ebe5]/50 transition-all duration-300
                             transform hover:scale-[1.02] active:scale-[0.98] flex flex-col h-full"
                >
                  {/* Course Image - Optimized for mobile */}
                  <div className="relative overflow-hidden rounded-t-xl sm:rounded-t-2xl lg:rounded-t-3xl aspect-video bg-white flex items-center justify-center">
                    {/* Loading Skeleton */}
                    {!isLoaded && (
                      <div className="absolute inset-0 bg-gray-700/30">
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-12 h-12 border-3 border-[#26ebe5]/30 border-t-[#26ebe5] rounded-full animate-spin"></div>
                        </div>
                      </div>
                    )}
                    
                    <Image
                      key={`${imageKey}-${displaySrc}`}
                      src={displaySrc}
                      alt={finalSEO.alt}
                      title={finalSEO.title}
                      width={600}
                      height={338}
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      quality={75}
                      priority={isPriority && !hasError}
                      loading={isPriority && !hasError ? undefined : "lazy"}
                      className={`w-full h-full object-contain object-center transition-all duration-300 group-hover:scale-110 ${
                        isLoaded ? 'opacity-100' : 'opacity-0'
                      }`}
                      onLoad={() => {
                        const currentKey = hasError ? fallbackKey : imageKey;
                        setLoadedImages(prev => new Set([...prev, currentKey]));
                      }}
                      onError={() => {
                        if (!hasError) {
                          setImageErrors(prev => new Map([...prev, [imageKey, true]]));
                        }
                      }}
                    />
                  </div>

                {/* Content */}
                <div className="p-3 sm:p-4 lg:p-6 text-black flex flex-col flex-1">
                  <h3 className="text-base sm:text-lg lg:text-xl xl:text-2xl font-semibold mb-2 sm:mb-3 line-clamp-2 drop-shadow-md">
                    {course.title}
                  </h3>
                  {/* <p className="hidden md:block text-black text-xs md:text-sm mb-3 md:mb-4 line-clamp-2 md:line-clamp-3">
                    {course.description}
                  </p> */}

                  {/* Button with neon glow */}
                  <button className="w-full sm:w-auto px-4 py-2 sm:py-2.5 bg-[#00448a] hover:bg-[#003a76] text-white 
                                     rounded-lg text-xs sm:text-sm font-medium 
                                     shadow-md hover:shadow-[#26ebe5]/50 transition-all duration-300
                                     flex items-center justify-center gap-2 mt-auto">
                    <span>View Course</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </div>

                {/* Neon border effect */}
                <div className="absolute inset-0 border-2 border-transparent group-hover:border-[#26ebe5] rounded-xl sm:rounded-2xl lg:rounded-3xl transition-all duration-300 pointer-events-none"></div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </CheckAuth>
  );
}

//-------------------------------------------------------------------

