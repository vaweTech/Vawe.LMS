"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import Image from "next/image";

import {
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  TrophyIcon,
  CameraIcon,
  HomeIcon,
  RectangleStackIcon,
  BookOpenIcon,
  BriefcaseIcon,
  AcademicCapIcon,
  CommandLineIcon,
  PuzzlePieceIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/solid";

export default function Navbar({
  userEmail = "VAWE@gmail.com",
  userName = "VAWE",
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resolvedUserEmail, setResolvedUserEmail] = useState(userEmail);
  const [resolvedUserName, setResolvedUserName] = useState(userName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState("");
  const [changeSuccess, setChangeSuccess] = useState("");
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [programsDropdownOpen, setProgramsDropdownOpen] = useState(false);
  const [programsMobileExpanded, setProgramsMobileExpanded] = useState(false);
  /** When set, college admin: Trainings submenu only shows LMS and/or CRT links per superadmin form */
  const [collegeNavModules, setCollegeNavModules] = useState(null);
  
  // Refs for click-outside detection and dropdown hover timers
  const desktopMenuRef = useRef(null);
  const desktopMenuButtonRef = useRef(null);
  const programsDropdownRef = useRef(null);
  const programsDropdownCloseTimeoutRef = useRef(null);

  // Handle scroll behavior - hide on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY < 10) {
        // Always show navbar at the top
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY) {
        // Scrolling down - hide navbar
        setIsVisible(false);
        // Close any open menus when hiding
        setMenuOpen(false);
        setMobileMenuOpen(false);
        setProgramsDropdownOpen(false);
      } else {
        // Scrolling up - show navbar
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Handle click outside to close menus
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close desktop dropdown menu if clicking outside
      if (
        menuOpen &&
        desktopMenuRef.current &&
        !desktopMenuRef.current.contains(event.target) &&
        desktopMenuButtonRef.current &&
        !desktopMenuButtonRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Close Programs dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        programsDropdownOpen &&
        programsDropdownRef.current &&
        !programsDropdownRef.current.contains(event.target)
      ) {
        setProgramsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [programsDropdownOpen]);

  // Load actual user info from Firebase
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setResolvedUserEmail(u.email || userEmail);
        setCollegeNavModules(null);
        try {
          const [snap, userSnap] = await Promise.all([
            getDoc(doc(db, "students", u.uid)),
            getDoc(doc(db, "users", u.uid)),
          ]);

          if (userSnap.exists()) {
            const ud = userSnap.data();
            if (ud.role === "collegeAdmin") {
              setCollegeNavModules({
                moduleLms: !!ud.moduleLms,
                moduleCrt: !!ud.moduleCrt,
              });
            }
          }

          if (snap.exists()) {
            const data = snap.data();
            setResolvedUserName(data?.name || userName);
            setIsLocked(Boolean(data?.locked));
          } else {
            // Fallback: query by uid field (handles docs created with auto IDs)
            const q = query(collection(db, "students"), where("uid", "==", u.uid));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
              const data = qSnap.docs[0].data();
              setResolvedUserName(data?.name || userName);
              setIsLocked(Boolean(data?.locked));
            } else {
              setResolvedUserName(
                u.displayName || (userSnap.exists() && userSnap.data()?.name) || userName
              );
              setIsLocked(false);
            }
          }
        } catch (e) {
          setResolvedUserName(userName);
          setIsLocked(false);
        }
      } else {
        setResolvedUserEmail(userEmail);
        setResolvedUserName(userName);
        setIsLocked(false);
        setCollegeNavModules(null);
      }
    });
    return () => unsub();
  }, [userEmail, userName]);

  // Handle profile pic upload
  const handlePicUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result); // Base64 preview
      };
      reader.readAsDataURL(file);
    }
  };

  // ✅ Logout handler
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      // no-op; still navigate away
    } finally {
      router.push("/");
    }
  };

  const handleOpenSettings = () => {
    setMenuOpen(false);
    setMobileMenuOpen(false);
    setSettingsOpen(true);
  };

  const handleChangePassword = async () => {
    setChangeError("");
    setChangeSuccess("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setChangeError("Please fill in all fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangeError("New password and confirmation do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setChangeError("New password must be at least 6 characters.");
      return;
    }
    const user = auth.currentUser;
    if (!user || !user.email) {
      setChangeError("No authenticated user found.");
      return;
    }
    setChangeLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      // Also update the password in Firestore so Admin pages reflect the change
      try {
        const byUidRef = doc(db, "students", user.uid);
        const byUidSnap = await getDoc(byUidRef);
        if (byUidSnap.exists()) {
          await updateDoc(byUidRef, { password: newPassword });
        } else {
          const q = query(collection(db, "students"), where("uid", "==", user.uid));
          const qSnap = await getDocs(q);
          if (!qSnap.empty) {
            const foundDocId = qSnap.docs[0].id;
            await updateDoc(doc(db, "students", foundDocId), { password: newPassword });
          }
        }
        // Mirror for trainers list: update users collection doc (often created with auto ID)
        try {
          const uq = query(collection(db, "users"), where("email", "==", user.email));
          const uqSnap = await getDocs(uq);
          if (!uqSnap.empty) {
            // Update all matches to be safe
            await Promise.all(uqSnap.docs.map((d) => updateDoc(doc(db, "users", d.id), { trainerPassword: newPassword })));
          }
        } catch (_) {}
      } catch (e) {
        // best-effort: ignore Firestore mirror failures
      }
      setChangeSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const code = err?.code || "";
      let message = err?.message || "Failed to update password.";
      if (code === "auth/wrong-password") message = "Current password is incorrect.";
      if (code === "auth/too-many-requests") message = "Too many attempts. Try again later.";
      if (code === "auth/weak-password") message = "New password is too weak.";
      if (code === "auth/requires-recent-login") message = "Please sign in again and retry.";
      setChangeError(message);
    } finally {
      setChangeLoading(false);
    }
  };

  const navigationLinks = useMemo(() => {
    const allProgramsSubLinks = [
      { href: "/courses", label: "Courses", icon: BookOpenIcon, kind: "lms" },
      { href: "/internships", label: "Internships", icon: BriefcaseIcon, kind: "lms" },
      { href: "/crt", label: "CRT Programmes", icon: AcademicCapIcon, kind: "crt" },
    ];

    let programsSubLinks = allProgramsSubLinks;
    if (collegeNavModules) {
      const { moduleLms, moduleCrt } = collegeNavModules;
      programsSubLinks = allProgramsSubLinks.filter((item) => {
        if (item.kind === "crt") return moduleCrt;
        return moduleLms;
      }).map(({ kind: _k, ...rest }) => rest);
    } else {
      programsSubLinks = allProgramsSubLinks.map(({ kind: _k, ...rest }) => rest);
    }

    const coreLinks = [
      { href: "/main", icon: HomeIcon, label: "Home" },
      { href: "/dashboard", icon: RectangleStackIcon, label: "Dashboard" },
    ];
    const afterTrainings = [
      { href: "/assignments", icon: CommandLineIcon, label: "Progress Tests" },
      { href: "/compiler", icon: CommandLineIcon, label: "Compiler" },
      { href: "/practice", icon: PuzzlePieceIcon, label: "Practice" },
    ];

    const allLinks =
      programsSubLinks.length > 0
        ? [
            ...coreLinks,
            { label: "Trainings", icon: BookOpenIcon, children: programsSubLinks },
            ...afterTrainings,
          ]
        : [...coreLinks, ...afterTrainings];

    return isLocked
      ? allLinks.filter((l) => l.href && ["/main", "/dashboard"].includes(l.href))
      : allLinks;
  }, [collegeNavModules, isLocked]);

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 bg-[#00448a] text-white shadow-lg px-4 sm:px-6 py-3 flex justify-between items-center z-50 transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>
        {/* Left Section: Mobile Menu + Logo */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-full hover:bg-white/10 md:hidden"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? (
              <XMarkIcon className="w-6 h-6 text-white" />
            ) : (
              <Bars3Icon className="w-6 h-6 text-white" />
            )}
          </button>

          {/* Desktop Profile Menu Toggle */}
          <div className="relative hidden md:block">
            <button
              ref={desktopMenuButtonRef}
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-full hover:bg-white/10"
              aria-label="Toggle profile menu"
            >
              {menuOpen ? (
                <XMarkIcon className="w-7 h-7 text-white" />
              ) : (
                <Bars3Icon className="w-7 h-7 text-white" />
              )}
            </button>

            {/* Desktop Dropdown Menu */}
            {menuOpen && (
              <div ref={desktopMenuRef} className="absolute left-0 mt-3 bg-white shadow-xl rounded-xl w-72 p-5 border animate-fade-in z-[70]">
                {/* Profile Section */}
                <div className="flex flex-col items-center mb-4 border-b pb-4">
                  <div className="relative">
                    {profilePic ? (
                      <Image
                        src={profilePic}
                        alt="Profile"
                        width={64}
                        height={64}
                        className="w-16 h-16 rounded-full object-cover border-2 border-[#26ebe5]"
                      />
                    ) : (
                      <UserCircleIcon className="w-16 h-16 text-[#26ebe5]" />
                    )}

                    {/* Hidden input for file upload */}
                    <input
                      type="file"
                      accept="image/*"
                      id="profileUpload"
                      className="hidden"
                      onChange={handlePicUpload}
                    />

                    {/* Add/change pic button */}
                    <label
                      htmlFor="profileUpload"
                      className="absolute bottom-0 right-0 bg-gray-600 text-white p-1 rounded-full hover:bg-[#00448a]/80 cursor-pointer"
                    >
                      <CameraIcon className="w-4 h-4" />
                    </label>
                  </div>

                  <p className="mt-2 font-semibold text-gray-900">{resolvedUserName}</p>
                  <p className="text-sm text-gray-600">{resolvedUserEmail}</p>
                  <button
                    onClick={handleLogout}
                    className="mt-2 px-4 py-2 rounded-xl border bg-[#00448a] text-white hover:bg-[#003a76] transition"
                  >
                    Log Out
                  </button>
                </div>

                {/* Menu Options */}
                <ul className="space-y-3 text-gray-700 font-medium">
                  <li className="flex items-center space-x-2 hover:text-[#26ebe5] transition cursor-pointer">
                    <TrophyIcon className="w-5 h-5" />
                    <span>Achievements</span>
                  </li>
                  <li
                    className="flex items-center space-x-2 hover:text-[#26ebe5] transition cursor-pointer"
                    onClick={handleOpenSettings}
                  >
                    <Cog6ToothIcon className="w-5 h-5" />
                    <span>Settings</span>
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Logo + Title */}
          <div className="flex items-center space-x-2">
            <Image 
              src="/logo1.png" 
              alt="VAWE LMS Logo" 
              width={32} 
              height={32} 
              className="h-8 w-8 sm:h-10 sm:w-10 rounded-full" 
            />
           <h1 className="text-lg sm:text-xl font-bold tracking-wide " style={{ fontFamily: '"Times New Roman", Times, serif' }}>
              VAWE INSTITUTES
            </h1>
          </div>
        </div>

        {/* Right Section: Desktop/Tablet Navigation Links (md = tablet, lg = laptop) */}
        <ul className="hidden md:flex md:space-x-3 lg:space-x-6 font-medium items-center">
          {navigationLinks.map((link) =>
            link.children ? (
              <li
                key="programs"
                ref={programsDropdownRef}
                className="relative"
                onMouseEnter={() => {
                  if (programsDropdownCloseTimeoutRef.current) {
                    clearTimeout(programsDropdownCloseTimeoutRef.current);
                    programsDropdownCloseTimeoutRef.current = null;
                  }
                  setProgramsDropdownOpen(true);
                }}
                onMouseLeave={() => {
                  programsDropdownCloseTimeoutRef.current = setTimeout(() => {
                    setProgramsDropdownOpen(false);
                    programsDropdownCloseTimeoutRef.current = null;
                  }, 200);
                }}
              >
                <button
                  onClick={() => setProgramsDropdownOpen(!programsDropdownOpen)}
                  className="flex items-center space-x-1 text-white hover:text-[#26ebe5] transition"
                >
                  <link.icon className="w-5 h-5" />
                  <span>{link.label}</span>
                  <ChevronDownIcon
                    className={`w-4 h-4 transition-transform ${programsDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {programsDropdownOpen && (
                  <div className="absolute left-0 top-full mt-2 pt-1.5">
                    <div className="bg-white text-gray-800 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.2)] rounded-xl py-1.5 min-w-[220px] border border-gray-100 animate-fade-in">
                      {link.children.map((sub) => {
                        const SubIcon = sub.icon;
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-[#26ebe5]/10 hover:text-[#00448a] transition-colors first:rounded-t-[11px] last:rounded-b-[11px]"
                            onClick={() => setProgramsDropdownOpen(false)}
                          >
                            {SubIcon && <SubIcon className="w-5 h-5 shrink-0 text-[#00448a]/70" />}
                            <span className="font-medium">{sub.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </li>
            ) : (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex items-center space-x-1 text-white hover:text-[#26ebe5] transition"
                >
                  <link.icon className="w-5 h-5" />
                  <span>{link.label}</span>
                </Link>
              </li>
            )
          )}
        </ul>
      </nav>

      {/* Mobile Menu Overlay (hidden on tablet md and up) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50" 
            onClick={() => setMobileMenuOpen(false)}
          />
          
          {/* Mobile Menu */}
          <div className="fixed left-0 top-3 bottom-3 w-80 max-w-[85vw] max-h-[670px] bg-white shadow-2xl rounded-r-2xl overflow-hidden transform transition-transform duration-300 ease-in-out">
            <div className="flex flex-col h-full">
              {/* Mobile Menu Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center space-x-2">
                  <Image 
                    src="/logo1.png" 
                    alt="VAWE LMS Logo" 
                    width={32} 
                    height={32} 
                    className="h-8 w-8 rounded-full" 
                  />
                  <h2 className="text-lg font-bold text-gray-900">Menu</h2>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10"
                >
                  <XMarkIcon className="w-6 h-6 text-gray-600" />
                </button>
              </div>

              {/* Mobile Profile Section */}
              <div className="p-4 border-b bg-gray-50">
                <div className="flex items-center space-x-3">
                  {profilePic ? (
                    <Image
                      src={profilePic}
                      alt="Profile"
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-full object-cover border-2 border-[#26ebe5]"
                    />
                  ) : (
                    <UserCircleIcon className="w-12 h-12 text-[#26ebe5]" />
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">{resolvedUserName}</p>
                    <p className="text-sm text-gray-600">{resolvedUserEmail}</p>
                  </div>
                </div>
              </div>

              {/* Mobile Navigation Links */}
              <div className="flex-1 overflow-y-auto">
                <ul className="py-4">
                  {navigationLinks.map((link) =>
                    link.children ? (
                      <li key="programs">
                        <button
                          onClick={() => setProgramsMobileExpanded(!programsMobileExpanded)}
                          className="flex items-center justify-between w-full space-x-3 px-4 py-3 text-gray-700 hover:bg-[#26ebe5]/10 hover:text-[#00448a] transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <link.icon className="w-5 h-5" />
                            <span className="font-medium">{link.label}</span>
                          </div>
                          <ChevronDownIcon
                            className={`w-5 h-5 transition-transform ${programsMobileExpanded ? "rotate-180" : ""}`}
                          />
                        </button>
                        {programsMobileExpanded && (
                          <ul className="bg-gray-50/80 border-l-2 border-[#26ebe5] ml-4 mr-2 mt-1 mb-2 rounded-r-lg overflow-hidden">
                            {link.children.map((sub) => {
                              const SubIcon = sub.icon;
                              return (
                                <li key={sub.href}>
                                  <Link
                                    href={sub.href}
                                    onClick={() => {
                                      setMobileMenuOpen(false);
                                      setProgramsMobileExpanded(false);
                                    }}
                                    className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-[#26ebe5]/10 hover:text-[#00448a] transition-colors text-sm font-medium"
                                  >
                                    {SubIcon && <SubIcon className="w-5 h-5 shrink-0 text-[#00448a]/70" />}
                                    {sub.label}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    ) : (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-[#26ebe5]/10 hover:text-[#00448a] transition-colors"
                        >
                          <link.icon className="w-5 h-5" />
                          <span className="font-medium">{link.label}</span>
                        </Link>
                      </li>
                    )
                  )}
                </ul>

                {/* Mobile Menu Options */}
                <div className="border-t pt-4">
                  <ul className="px-4 space-y-2">
                    <li>
                      <button className="flex items-center space-x-3 w-full py-3 text-gray-700 hover:bg-[#26ebe5]/10 hover:text-[#00448a] transition-colors">
                        <TrophyIcon className="w-5 h-5" />
                        <span className="font-medium">Achievements</span>
                      </button>
                    </li>
                    <li>
                      <button 
                        onClick={handleOpenSettings}
                        className="flex items-center space-x-3 w-full py-3 text-gray-700 hover:bg-[#26ebe5]/10 hover:text-[#00448a] transition-colors"
                      >
                        <Cog6ToothIcon className="w-5 h-5" />
                        <span className="font-medium">Settings</span>
                      </button>
                    </li>
                    <li>
                      <button 
                        onClick={handleLogout}
                        className="flex items-center space-x-3 w-full py-3 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <XMarkIcon className="w-5 h-5" />
                        <span className="font-medium">Log Out</span>
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSettingsOpen(false)} />
          <div className="relative bg-white w-full max-w-lg mx-4 rounded-2xl shadow-2xl p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Settings</h2>
              <button
                className="px-3 py-1 rounded-lg border text-gray-700 hover:bg-gray-100"
                onClick={() => setSettingsOpen(false)}
              >
                Close
              </button>
            </div>

            {/* Profile Details */}
            <div className="mb-6">
              <p className="text-sm text-gray-500">Signed in as</p>
              <p className="text-lg font-semibold text-gray-900">{resolvedUserName}</p>
              <p className="text-gray-700">{resolvedUserEmail}</p>
            </div>

            {/* Change Password */}
            <div className="bg-gray-50 rounded-xl p-4 border">
              <h3 className="font-semibold text-gray-900 mb-4">Change Password</h3>
              {changeError && (
                <p className="text-sm text-red-600 mb-3">{changeError}</p>
              )}
              {changeSuccess && (
                <p className="text-sm text-green-600 mb-3">{changeSuccess}</p>
              )}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Current password</label>
                  <input
                    type="password"
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#26ebe5]"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">New password</label>
                  <input
                    type="password"
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#26ebe5]"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Confirm new password</label>
                  <input
                    type="password"
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#26ebe5]"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                  />
                </div>
                <button
                  className="mt-2 px-4 py-2 rounded-xl bg-[#00448a] text-white hover:bg-[#003a76] disabled:opacity-60"
                  onClick={handleChangePassword}
                  disabled={changeLoading}
                >
                  {changeLoading ? "Updating..." : "Update password"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}