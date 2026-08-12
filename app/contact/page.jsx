"use client";
import { motion } from "framer-motion";
import { useState } from "react";


export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    course: '',
    message: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle form submission
    console.log('Form submitted:', formData);
    alert('Thank you for your inquiry! We will contact you soon.');
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Contact <span className="text-yellow-300">VAWE Institute</span>
            </h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Ready to start your software development journey? Get in touch with us today. 
              Our expert team is here to guide you towards a successful career in programming.
            </p>
            <div className="mt-6">
              <a
                href="https://www.vaweinstitute.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-yellow-300 text-blue-900 px-6 py-3 rounded-lg font-semibold hover:bg-yellow-400 transition-colors"
              >
                Visit Our Website
              </a>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Get in Touch with VAWE Institute
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Have questions about our programming courses? Need career guidance? 
              Our team is ready to help you take the next step in your learning journey.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {[
              {
                title: "Visit Our Campus",
                description: "Come and experience our modern infrastructure and meet our expert faculty",
                details: [
                  "VAWE Institute",
                  "Software Training Center",
                  "Vijayawada, Andhra Pradesh, India",
                  "India - 520001"
                ],
                icon: "📍"
              },
              {
                title: "Call Us",
                description: "Speak directly with our admission counselors for immediate assistance",
                details: [
                  "+91 8885103333",
                  "8885103333",
                  "Mon - Sat: 9:00 AM - 6:00 PM",
                  "Sunday: 10:00 AM - 4:00 PM"
                ],
                icon: "📞"
              },
              {
                title: "Email Us",
                description: "Send us your queries and we'll respond within 24 hours",
                details: [
                  "vawe.info@gmail.com"
                ],
                icon: "✉️"
              },
              {
                title: "Website",
                description: "For more information about our courses and services",
                details: [
                  "https://www.vaweinstitute.com/"
                ],
                icon: "🌐"
              }
            ].map((contact, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="bg-white p-6 rounded-xl shadow-lg text-center"
              >
                <div className="text-4xl mb-4">{contact.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{contact.title}</h3>
                <p className="text-gray-600 mb-4">{contact.description}</p>
                <div className="space-y-2">
                  {contact.details.map((detail, idx) => (
                    typeof detail === 'string' && /^https?:\/\//.test(detail) ? (
                      <a
                        key={idx}
                        href={detail}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 underline break-all"
                      >
                        {detail}
                      </a>
                    ) : (
                      <p key={idx} className="text-sm text-gray-700">{detail}</p>
                    )
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Contact Form */}
      <div className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Send Us a Message</h2>
              <p className="text-lg text-gray-600 mb-8">
                Ready to enroll in our programming courses? Have questions about our software training programs? 
                Fill out the form below and our team will get back to you within 24 hours.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your email address"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your phone number"
                  />
                </div>

                <div>
                  <label htmlFor="course" className="block text-sm font-medium text-gray-700 mb-2">
                    Interested Course
                  </label>
                  <select
                    id="course"
                    name="course"
                    value={formData.course}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a course</option>
                    <option value="python">Python Programming</option>
                    <option value="java">Java Programming</option>
                    <option value="web-development">Full Stack Web Development</option>
                    <option value="react">React Development</option>
                    <option value="data-science">Data Science & Machine Learning</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    value={formData.message}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Tell us about your goals and how we can help you"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Send Message
                </button>
              </form>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-gray-50 p-8 rounded-xl"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Why Choose VAWE Institute?</h3>
              
              <div className="space-y-6">
                {[
                  {
                    title: "Expert Faculty",
                    description: "Learn from industry professionals with years of real-world experience"
                  },
                  {
                    title: "Modern Curriculum",
                    description: "Stay updated with the latest technologies and industry trends"
                  },
                  {
                    title: "Placement Assistance",
                    description: "95% placement success rate with top IT companies"
                  },
                  {
                    title: "Flexible Learning",
                    description: "Multiple batch timings to fit your schedule"
                  },
                  {
                    title: "Hands-on Projects",
                    description: "Build real-world applications and build a strong portfolio"
                  }
                ].map((feature, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm">✓</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{feature.title}</h4>
                      <p className="text-gray-600 text-sm">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-6 bg-blue-600 text-white rounded-lg">
                <h4 className="font-semibold mb-2">Quick Response Guarantee</h4>
                <p className="text-blue-100 text-sm">
                  We respond to all inquiries within 24 hours. For urgent queries, 
                  please call us directly.
                </p>
                <p className="text-blue-100 text-sm mt-3">
                  For more information, visit{' '}
                  <a
                    href="https://www.vaweinstitute.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold"
                  >
                    www.vaweinstitute.com
                  </a>.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Map Section */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Find Us in Vijayawada</h2>
            <p className="text-lg text-gray-600">
              Visit our campus and experience the best software training institute in Vijayawada
            </p>
          </motion.div>

          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="rounded-lg overflow-hidden">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d239.09362574184777!2d80.6461280614545!3d16.50093700741645!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a35faba842a60c9%3A0x2d5a839dfcea2ef8!2sVAWE%20INSTITUTES!5e0!3m2!1sen!2sin!4v1764045336512!5m2!1sen!2sin"
                width="100%"
                height="450"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
