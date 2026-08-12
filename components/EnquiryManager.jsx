"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Phone, Mail, Download, RefreshCw, Search, UserCheck, Trash2 } from "lucide-react";
import {
  getLocalTodayDateString,
  validateDateOfBirth,
  validateDateOfJoining,
} from "@/lib/formDateValidation";

export default function EnquiryManager({
  onSubmit,
  onExportEmails,
  onDownloadCSV,
  className = "",
  enquiries = [],
  totalCount = 0,
  search = "",
  onSearchChange,
  page = 0,
  onPageChange,
  pageSize = 10,
  onAllowDemo,
  onDeleteEnquiry,
  renderEnquiryStatus,
  formOnly = false,
  onCancel,
}) {
  const [showEnquiryForm, setShowEnquiryForm] = useState(formOnly);
  const [submittingEnquiry, setSubmittingEnquiry] = useState(false);
  const [enquiryForm, setEnquiryForm] = useState({
    name: "",
    email: "",
    phone: "",
    gender: "",
    dob: "",
    dateOfJoining: "",
    qualification: "",
    college: "",
    yearOfPassing: "",
    workExp: "",
    company: "",
    course: "",
    timingsPreferred: "",
    reference: "",
    remarks: ""
  });

  const todayDateStr = getLocalTodayDateString();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const dobCheck = validateDateOfBirth(enquiryForm.dob);
    if (!dobCheck.valid) {
      alert(dobCheck.message);
      return;
    }

    const joiningCheck = validateDateOfJoining(enquiryForm.dateOfJoining);
    if (!joiningCheck.valid) {
      alert(joiningCheck.message);
      return;
    }

    setSubmittingEnquiry(true);

    try {
      await onSubmit(enquiryForm);
      
      // Reset form on success
      setEnquiryForm({
        name: "",
        email: "",
        phone: "",
        gender: "",
        dob: "",
        dateOfJoining: "",
        qualification: "",
        college: "",
        yearOfPassing: "",
        workExp: "",
        company: "",
        course: "",
        timingsPreferred: "",
        reference: "",
        remarks: ""
      });
      setShowEnquiryForm(false);
      if (formOnly) onCancel?.();
    } catch (error) {
      console.error("Error submitting enquiry:", error);
    } finally {
      setSubmittingEnquiry(false);
    }
  };

  const listSearchEl = onSearchChange ? (
    <div className="relative mb-3">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by name, email, phone, course..."
        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      />
    </div>
  ) : null;

  const listPaginationEl = (() => {
    if (!onPageChange || !totalCount) return null;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(page, totalPages - 1);
    const start = safePage * pageSize + 1;
    const end = Math.min((safePage + 1) * pageSize, totalCount);
    return (
      <div className="flex items-center justify-between gap-3 border-t pt-3 mt-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(0, safePage - 1))}
          disabled={safePage === 0}
          className="inline-flex h-8 items-center justify-center rounded-lg bg-gray-100 px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Back
        </button>
        <span className="text-xs font-medium text-gray-600">
          {start}-{end} of {totalCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))}
          disabled={safePage >= totalPages - 1}
          className="inline-flex h-8 items-center justify-center rounded-lg bg-gray-100 px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    );
  })();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white border border-gray-200 rounded-2xl shadow-md mb-8 min-w-0 h-full ${className}`}
    >
      {!formOnly && (
      <div className="p-4 sm:p-6 border-b bg-gradient-to-r from-[#fdc377]/20 to-[#26ebe5]/20">
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-semibold text-gray-900 sm:text-lg">Recent Enquiries</h3>
          <div className="flex items-center gap-1.5 flex-nowrap">
            <button 
              onClick={onExportEmails}
              className="inline-flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-green-600 px-2.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
              title="Copy all email addresses"
            >
              <Mail className="h-3 w-3 shrink-0" />
              <span className="hidden min-[420px]:inline">Copy Emails</span>
              <span className="min-[420px]:hidden">Copy</span>
            </button>
            <button 
              onClick={onDownloadCSV}
              className="inline-flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-blue-600 px-2.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
              title="Download as CSV"
            >
              <Download className="h-3 w-3 shrink-0" />
              CSV
            </button>
            <button 
              onClick={() => setShowEnquiryForm(!showEnquiryForm)}
              className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg bg-purple-600 px-2.5 text-xs font-medium text-white transition-colors hover:bg-purple-700"
            >
              {showEnquiryForm ? "Cancel" : "+ Add Enquiry"}
            </button>
          </div>
        </div>
      </div>
      )}

      {formOnly && (
        <div className="flex items-center justify-between border-b p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900">New Enquiry</h3>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-8 items-center justify-center rounded-lg px-3 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
          )}
        </div>
      )}
      
      <div className={`p-4 sm:p-6 ${formOnly ? "max-h-[calc(100vh-14rem)] overflow-y-auto" : ""}`}>
        {!formOnly && !showEnquiryForm && (
          <>
            {listSearchEl}
            {enquiries.length > 0 ? (
              <div className="space-y-3 mb-2">
                {enquiries.map((enquiry, index) => (
                  <div
                    key={enquiry.id || index}
                    className="grid grid-cols-1 gap-3 p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 min-w-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Phone className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 break-words">{enquiry.name}</p>
                        <p className="text-xs text-gray-500 break-all">{enquiry.email}</p>
                        <p className="text-xs text-gray-500">{enquiry.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-gray-200/80 pt-3 lg:justify-end lg:gap-3 lg:border-t-0 lg:pt-0">
                      <div className="flex min-w-0 flex-col items-start gap-0.5 lg:items-end">
                        {renderEnquiryStatus ? renderEnquiryStatus(enquiry) : null}
                        <p className="text-xs text-gray-500 break-words">{enquiry.course}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                      {onAllowDemo && (
                        <button
                          type="button"
                          onClick={() => onAllowDemo(enquiry)}
                          className="inline-flex h-8 items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 px-2.5 text-xs font-medium text-white transition-colors hover:from-green-600 hover:to-emerald-600"
                          title="Allow Demo"
                        >
                          <UserCheck className="h-3.5 w-3.5 shrink-0" />
                          <span className="hidden xl:inline">Allow Demo</span>
                          <span className="xl:hidden">Demo</span>
                        </button>
                      )}
                      {onDeleteEnquiry && enquiry.id && (
                        <button
                          type="button"
                          onClick={() => onDeleteEnquiry(enquiry.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50"
                          title="Delete enquiry"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 mb-2">
                <Phone className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="mb-2 font-medium">
                  {search ? "No matching enquiries" : "No recent enquiries yet"}
                </p>
                <p className="text-xs text-gray-400">
                  Click &quot;+ Add Enquiry&quot; to record new student enquiries
                </p>
              </div>
            )}
            {listPaginationEl}
          </>
        )}

        {/* Enquiry Form */}
        {(formOnly || showEnquiryForm) && (
          <form onSubmit={handleSubmit} className={`${formOnly ? "" : "mb-6"} p-6 bg-purple-50 rounded-lg border border-purple-200 max-h-[600px] overflow-y-auto`}>
            {!formOnly && <h4 className="text-lg font-semibold text-gray-900 mb-4">New Enquiry Form</h4>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Student Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Student Name *</label>
                <input
                  type="text"
                  value={enquiryForm.name}
                  onChange={(e) => setEnquiryForm({...enquiryForm, name: e.target.value})}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Full name"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="gender"
                      value="Male"
                      checked={enquiryForm.gender === "Male"}
                      onChange={(e) => setEnquiryForm({...enquiryForm, gender: e.target.value})}
                      required
                      className="mr-2"
                    />
                    <span className="text-sm">Male</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="gender"
                      value="Female"
                      checked={enquiryForm.gender === "Female"}
                      onChange={(e) => setEnquiryForm({...enquiryForm, gender: e.target.value})}
                      className="mr-2"
                    />
                    <span className="text-sm">Female</span>
                  </label>
                </div>
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                <input
                  type="date"
                  value={enquiryForm.dob}
                  onChange={(e) => setEnquiryForm({...enquiryForm, dob: e.target.value})}
                  required
                  max={todayDateStr}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Date of Joining */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining *</label>
                <input
                  type="date"
                  value={enquiryForm.dateOfJoining}
                  onChange={(e) => setEnquiryForm({...enquiryForm, dateOfJoining: e.target.value})}
                  required
                  min={todayDateStr}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Qualification */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qualification *</label>
                <input
                  type="text"
                  value={enquiryForm.qualification}
                  onChange={(e) => setEnquiryForm({...enquiryForm, qualification: e.target.value})}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="B.Tech, MCA, etc."
                />
              </div>

              {/* College */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">College *</label>
                <input
                  type="text"
                  value={enquiryForm.college}
                  onChange={(e) => setEnquiryForm({...enquiryForm, college: e.target.value})}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="College name"
                />
              </div>

              {/* Year of Passing */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year of Passing *</label>
                <input
                  type="text"
                  value={enquiryForm.yearOfPassing}
                  onChange={(e) => setEnquiryForm({...enquiryForm, yearOfPassing: e.target.value})}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="2024"
                />
              </div>

              {/* Work Experience */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work Experience</label>
                <input
                  type="text"
                  value={enquiryForm.workExp}
                  onChange={(e) => setEnquiryForm({...enquiryForm, workExp: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="2 years / Fresher"
                />
              </div>

              {/* Company */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  value={enquiryForm.company}
                  onChange={(e) => setEnquiryForm({...enquiryForm, company: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Company name"
                />
              </div>

              {/* Mobile No */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile No. *</label>
                <input
                  type="tel"
                  value={enquiryForm.phone}
                  onChange={(e) => setEnquiryForm({...enquiryForm, phone: e.target.value})}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="+91 9876543210"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail ID *</label>
                <input
                  type="email"
                  value={enquiryForm.email}
                  onChange={(e) => setEnquiryForm({...enquiryForm, email: e.target.value})}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="email@example.com"
                />
              </div>

              {/* Course Required */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course Required *</label>
                <select
                  value={enquiryForm.course}
                  onChange={(e) => setEnquiryForm({...enquiryForm, course: e.target.value})}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select course</option>
                  <option value="React JS">React JS</option>
                  <option value="Python">Python</option>
                  <option value="Full Stack Development">Full Stack Development</option>
                  <option value="Java">Java</option>
                  <option value="Data Science">Data Science</option>
                  <option value="Data Analyst">Data Analyst</option>
                  <option value="Machine Learning">Machine Learning</option>
                  <option value="Web Development">Web Development</option>
                </select>
              </div>

              {/* Timings Preferred */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timings Preferred</label>
                <input
                  type="text"
                  value={enquiryForm.timingsPreferred}
                  onChange={(e) => setEnquiryForm({...enquiryForm, timingsPreferred: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Morning / Evening / Weekends"
                />
              </div>

              {/* Reference */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Reference</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="reference"
                      value="Friends"
                      checked={enquiryForm.reference === "Friends"}
                      onChange={(e) => setEnquiryForm({...enquiryForm, reference: e.target.value})}
                      className="mr-2"
                    />
                    <span className="text-sm">Friends</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="reference"
                      value="News Paper"
                      checked={enquiryForm.reference === "News Paper"}
                      onChange={(e) => setEnquiryForm({...enquiryForm, reference: e.target.value})}
                      className="mr-2"
                    />
                    <span className="text-sm">News Paper</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="reference"
                      value="Flyers"
                      checked={enquiryForm.reference === "Flyers"}
                      onChange={(e) => setEnquiryForm({...enquiryForm, reference: e.target.value})}
                      className="mr-2"
                    />
                    <span className="text-sm">Flyers</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="reference"
                      value="TV"
                      checked={enquiryForm.reference === "TV"}
                      onChange={(e) => setEnquiryForm({...enquiryForm, reference: e.target.value})}
                      className="mr-2"
                    />
                    <span className="text-sm">TV</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="reference"
                      value="Online"
                      checked={enquiryForm.reference === "Online"}
                      onChange={(e) => setEnquiryForm({...enquiryForm, reference: e.target.value})}
                      className="mr-2"
                    />
                    <span className="text-sm">Online</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="reference"
                      value="Others"
                      checked={enquiryForm.reference === "Others"}
                      onChange={(e) => setEnquiryForm({...enquiryForm, reference: e.target.value})}
                      className="mr-2"
                    />
                    <span className="text-sm">Others</span>
                  </label>
                </div>
              </div>

              {/* Remarks */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  value={enquiryForm.remarks}
                  onChange={(e) => setEnquiryForm({...enquiryForm, remarks: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Additional remarks or notes..."
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowEnquiryForm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingEnquiry}
                className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {submittingEnquiry ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Enquiry'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </motion.div>
  );
}

