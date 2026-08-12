"use client";

import { useEffect, useState } from "react";

/**
 * Confidential site-map style page with open/close listing controls.
 * Used at /Admin/vawemap
 */
export default function VaweMapPage() {
  const [disabled, setDisabled] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const pages = [
    { title: "Home", url: "/", description: "Main landing page" },
    { title: "About Us", url: "/about", description: "About VAWE Institutes" },
    { title: "Courses", url: "/courses", description: "Programming courses" },
    { title: "Contact", url: "/contact", description: "Contact information" },
    { title: "Blog", url: "/blog", description: "Learning blog and tips" },
    { title: "Placement", url: "/placement", description: "Placement assistance" },
    { title: "Privacy Policy", url: "/privacy", description: "Privacy policy" },
    { title: "Terms of Service", url: "/terms", description: "Terms of service" },
  ];

  const coursePages = [
    { title: "Python Programming", url: "/courses/python" },
    { title: "Java Development", url: "/courses/java" },
    { title: "Web Development", url: "/courses/web-development" },
    { title: "React Training", url: "/courses/react" },
    { title: "Data Science", url: "/courses/data-science" },
    { title: "Full Stack Development", url: "/courses/full-stack" },
  ];

  async function loadStatus() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/app-status", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load status.");
      setDisabled(Boolean(data.disabled));
      setUpdatedAt(data.updatedAt || null);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to load service status.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function handleToggle(nextDisabled) {
    const ok = confirm(
      nextDisabled ? "Close the site map listing?" : "Open the site map listing?"
    );
    if (!ok) return;

    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/app-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disabled: nextDisabled,
          updatedBy: "vawemap",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Update failed.");
      setDisabled(Boolean(data.disabled));
      setUpdatedAt(data.updatedAt || null);
      setMessage(nextDisabled ? "Site map listing is closed." : "Site map listing is open.");
    } catch (e) {
      console.error(e);
      setError(e?.message || "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-white py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Sitemap</h1>
        <p className="text-lg text-gray-600 mb-8">
          Find all pages and sections of VAWE Institutes website organized by category.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Main Pages</h2>
            <ul className="space-y-2">
              {pages.map((page) => (
                <li key={page.url}>
                  <a
                    href={page.url}
                    className="text-blue-600 hover:text-blue-800 hover:underline block"
                  >
                    {page.title}
                  </a>
                  <p className="text-sm text-gray-500">{page.description}</p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Course Pages</h2>
            <ul className="space-y-2">
              {coursePages.map((course) => (
                <li key={course.url}>
                  <a
                    href={course.url}
                    className="text-blue-600 hover:text-blue-800 hover:underline block"
                  >
                    {course.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 p-6 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">XML Sitemap</h3>
          <p className="text-gray-600 mb-4">
            For search engines, you can access our XML sitemap at:
          </p>
          <a href="/sitemap.xml" className="text-blue-600 hover:text-blue-800 hover:underline">
            /sitemap.xml
          </a>
        </div>

        <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-transparent">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Site map listing</h3>
          <p className="text-gray-600 mb-4">
            Controls whether public pages in this listing are open or closed.
          </p>

          <p className="text-sm text-gray-700 mb-3">
            Status:{" "}
            {loading ? (
              <span className="text-gray-400">Loading…</span>
            ) : (
              <span className="text-gray-900 font-medium">{disabled ? "Closed" : "Open"}</span>
            )}
            {updatedAt ? (
              <span className="text-gray-500">
                {" "}
                · updated {new Date(updatedAt).toLocaleString()}
              </span>
            ) : null}
          </p>

          {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
          {message ? <p className="text-sm text-gray-700 mb-3">{message}</p> : null}

          <ul className="space-y-2">
            <li>
              <button
                type="button"
                disabled={loading || saving || disabled}
                onClick={() => handleToggle(true)}
                className="text-blue-600 hover:text-blue-800 hover:underline disabled:text-gray-400 disabled:no-underline text-left"
              >
                Close site map
              </button>
              <p className="text-sm text-gray-500">Closes public pages from this listing.</p>
            </li>
            <li>
              <button
                type="button"
                disabled={loading || saving || !disabled}
                onClick={() => handleToggle(false)}
                className="text-blue-600 hover:text-blue-800 hover:underline disabled:text-gray-400 disabled:no-underline text-left"
              >
                Open site map
              </button>
              <p className="text-sm text-gray-500">Opens public pages in this listing again.</p>
            </li>
            <li>
              <button
                type="button"
                disabled={loading || saving}
                onClick={loadStatus}
                className="text-blue-600 hover:text-blue-800 hover:underline disabled:text-gray-400 disabled:no-underline text-left"
              >
                Refresh listing
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
