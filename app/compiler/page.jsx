"use client";
import { useState } from "react";
import CodeEditor from "../../components/CodeEditor";
import CheckAuth from "../../lib/CheckAuth";

// Default starter code snippets for each language
const defaultSnippets = {
  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Java!");
    }
}`,
  python: `print("Hello, Python!")`,
  c: `#include <stdio.h>
int main() {
    printf("Hello, C!\\n");
    return 0;
}`,
  cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, C++!" << endl;
    return 0;
}`,
  javascript: `console.log("Hello, JavaScript!");`,
  mysql: `-- MySQL Query Example
SELECT 'Hello, MySQL!' AS message;

-- Create and query a sample table
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY,
    name VARCHAR(50)
);

INSERT INTO users VALUES (1, 'John Doe');
SELECT * FROM users;`,
  sql: `-- SQL Query Example
SELECT 'Hello, SQL!' AS message;

-- Create and query a sample table
CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    price DECIMAL(10,2)
);

INSERT INTO products VALUES (1, 'Product A', 99.99);
SELECT * FROM products;`,
  r: `# R Programming Example
print("Hello, R!")

# Simple calculation
x <- c(1, 2, 3, 4, 5)
mean_value <- mean(x)
cat("Mean:", mean_value, "\\n")`
};

export default function CompilerPage() {
  const [lang, setLang] = useState("cpp");
  const [code, setCode] = useState(defaultSnippets.cpp);
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("");
  const [dark, setDark] = useState(false);

  const handleLangChange = (e) => {
    const newLang = e.target.value;
    setLang(newLang);
    setCode(defaultSnippets[newLang] || "");
  };

  const runCode = async () => {
    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: lang,
          source: code,
          stdin: stdin
        })
      });
      const data = await res.json();
      if (res.ok) {
        setOutput(data.stdout || data.stderr || "No output");
      } else {
        setOutput("Error: " + data.error);
      }
    } catch (err) {
      setOutput("Request failed: " + err.message);
    }
  };

  return (
    <CheckAuth>
      <div className="min-h-screen bg-[#e4f2f7]">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 rounded-lg">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#00448a] to-[#26ebe5] bg-clip-text text-transparent">Online Compiler</h1>
          <div className="flex items-center gap-2">
            {dark ? (
              <svg className="w-4 h-4 text-slate-800" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="4" strokeWidth="2" />
                <path strokeLinecap="round" strokeWidth="2" d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" />
              </svg>
            )}
            <span className="text-sm font-medium text-slate-700">{dark ? 'Dark' : 'Light'}</span>
            <button
              onClick={() => setDark((d) => !d)}
              role="switch"
              aria-checked={dark}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${dark ? 'bg-slate-800' : 'bg-slate-300'}`}
              aria-label="Toggle editor dark mode"
            >
              <span className="sr-only">Toggle editor theme</span>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${dark ? 'translate-x-5' : 'translate-x-1'}`}></span>
            </button>
          </div>
        </div>

        {/* Language Selector */}
        <select
          value={lang}
          onChange={handleLangChange}
          className="bg-white text-slate-900 border border-gray-300 p-2 sm:p-3 rounded mb-4 text-sm sm:text-base w-full sm:w-auto focus:ring-2 focus:ring-[#26ebe5] focus:border-transparent"
        >
          <option value="cpp">C++</option>
          <option value="java">Java</option>
          <option value="python">Python</option>
          <option value="c">C</option>
          <option value="javascript">JavaScript</option>
          <option value="r">R</option>
          <option value="mysql">MySQL</option>
          <option value="sql">SQL (SQLite)</option>
        </select>

        {/* Code Editor */}
        <div className="mb-4">
          <CodeEditor language={lang} code={code} setCode={setCode} theme={dark ? "dark" : "light"} hideControls />
        </div>

        {/* Standard Input */}
        <textarea
          value={stdin}
          onChange={(e) => setStdin(e.target.value)}
          placeholder="Standard input (optional)"
          className="w-full h-16 sm:h-20 border border-gray-300 rounded p-2 sm:p-3 mt-4 text-sm sm:text-base focus:ring-2 focus:ring-[#26ebe5] focus:border-transparent"
        />

        {/* Run Button */}
        <button
          onClick={runCode}
          className="bg-[#00448a] text-white px-4 py-2 sm:py-3 rounded mt-4 hover:bg-[#003a76] text-sm sm:text-base font-medium shadow-lg"
        >
          Run Code
        </button>

        {/* Output */}
        <pre className="bg-[#00448a]/5 border border-[#26ebe5]/40 p-3 sm:p-4 mt-4 rounded whitespace-pre-wrap text-xs sm:text-sm">{output}</pre>
        </div>
      </div>
    </CheckAuth>
  );
}