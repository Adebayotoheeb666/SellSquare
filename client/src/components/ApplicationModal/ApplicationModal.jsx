import React, { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import "./ApplicationModal.scss";

const BACKEND_URL = "";

const ApplicationModal = ({ isOpen, onClose }) => {
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        phone: "",
        portfolioUrl: "",
        message: "",
        position: "Social Media Manager"
    });
    const [files, setFiles] = useState({
        cv: null,
        coverLetter: null
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleFileChange = (e) => {
        const { name, files: selectedFiles } = e.target;
        if (selectedFiles[0]) {
            // Validate file size (max 5MB)
            if (selectedFiles[0].size > 5 * 1024 * 1024) {
                toast.error(`${name} file must be less than 5MB`);
                return;
            }
            setFiles(prev => ({
                ...prev,
                [name]: selectedFiles[0]
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!formData.fullName || !formData.email || !formData.phone || !formData.position) {
            toast.error("Please fill in all required fields");
            return;
        }

        if (!files.cv || !files.coverLetter) {
            toast.error("Please upload both CV and Cover Letter");
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            toast.error("Please enter a valid email address");
            return;
        }

        // Phone validation (basic)
        const phoneRegex = /^[0-9+\-\s()]{7,}$/;
        if (!phoneRegex.test(formData.phone)) {
            toast.error("Please enter a valid phone number");
            return;
        }

        setIsSubmitting(true);

        try {
            // Create FormData for multipart file upload
            const submitData = new FormData();
            submitData.append("fullName", formData.fullName);
            submitData.append("email", formData.email);
            submitData.append("phone", formData.phone);
            submitData.append("portfolioUrl", formData.portfolioUrl);
            submitData.append("position", formData.position);
            submitData.append("message", formData.message);
            submitData.append("cv", files.cv);
            submitData.append("coverLetter", files.coverLetter);

            const response = await axios.post(`${BACKEND_URL}/api/apply`, submitData, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            });

            if (response.data.success) {
                toast.success(response.data.message || "Application submitted successfully!");
                // Reset form
                setFormData({
                    fullName: "",
                    email: "",
                    phone: "",
                    portfolioUrl: "",
                    message: "",
                    position: "Social Media Manager"
                });
                setFiles({
                    cv: null,
                    coverLetter: null
                });
                // Close modal after short delay
                setTimeout(() => onClose(), 1500);
            }
        } catch (error) {
            console.error("Application form error:", error);
            const errorMessage = error.response?.data?.message || "Failed to submit application. Please try again.";
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="app-modal-overlay" onClick={onClose}>
            <div className="app-modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="app-modal-header">
                    <h2>Apply for Marketing Internship</h2>
                    <button
                        className="app-modal-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                <form className="app-form" onSubmit={handleSubmit}>
                    <div className="app-form-section">
                        <h3>Your Information</h3>

                        <div className="app-form-row">
                            <div className="app-form-group">
                                <label htmlFor="fullName">Full Name *</label>
                                <input
                                    id="fullName"
                                    type="text"
                                    name="fullName"
                                    placeholder="John Doe"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    required
                                />
                            </div>
                            <div className="app-form-group">
                                <label htmlFor="email">Email *</label>
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    placeholder="john@example.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    required
                                />
                            </div>
                        </div>

                        <div className="app-form-row">
                            <div className="app-form-group">
                                <label htmlFor="phone">Phone Number *</label>
                                <input
                                    id="phone"
                                    type="tel"
                                    name="phone"
                                    placeholder="+234 (0) 123 456 7890"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    required
                                />
                            </div>
                            <div className="app-form-group">
                                <label htmlFor="position">Position *</label>
                                <select
                                    id="position"
                                    name="position"
                                    value={formData.position}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    required
                                >
                                    <option value="Social Media Manager">Social Media Manager</option>
                                    <option value="Email Marketing Specialist">Email Marketing Specialist</option>
                                    <option value="Growth Marketing Lead">Growth Marketing Lead</option>
                                </select>
                            </div>
                        </div>

                        <div className="app-form-group">
                            <label htmlFor="portfolioUrl">Portfolio URL (optional)</label>
                            <input
                                id="portfolioUrl"
                                type="url"
                                name="portfolioUrl"
                                placeholder="https://yourportfolio.com"
                                value={formData.portfolioUrl}
                                onChange={handleChange}
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <div className="app-form-section">
                        <h3>Documents</h3>

                        <div className="app-form-group">
                            <label htmlFor="cv">CV / Resume *</label>
                            <div className="app-file-input-wrapper">
                                <input
                                    id="cv"
                                    type="file"
                                    name="cv"
                                    accept=".pdf,.doc,.docx"
                                    onChange={handleFileChange}
                                    disabled={isSubmitting}
                                    required
                                />
                                <div className="app-file-label">
                                    {files.cv ? (
                                        <>
                                            <span className="app-file-icon">
                                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#295F2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#295F2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </span>
                                            <span>{files.cv.name}</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="app-file-icon">
                                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#295F2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </span>
                                            <span>Click to upload CV (PDF, DOC, DOCX)</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="app-form-group">
                            <label htmlFor="coverLetter">Cover Letter *</label>
                            <div className="app-file-input-wrapper">
                                <input
                                    id="coverLetter"
                                    type="file"
                                    name="coverLetter"
                                    accept=".pdf,.doc,.docx"
                                    onChange={handleFileChange}
                                    disabled={isSubmitting}
                                    required
                                />
                                <div className="app-file-label">
                                    {files.coverLetter ? (
                                        <>
                                            <span className="app-file-icon">
                                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#295F2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#295F2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </span>
                                            <span>{files.coverLetter.name}</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="app-file-icon">
                                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#295F2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </span>
                                            <span>Click to upload Cover Letter (PDF, DOC, DOCX)</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="app-form-section">
                        <h3>Additional Information</h3>

                        <div className="app-form-group">
                            <label htmlFor="message">Tell us why you'd be great for this role (optional)</label>
                            <textarea
                                id="message"
                                name="message"
                                placeholder="Share your passion for marketing, what excites you about SellSquare, or anything else you'd like us to know..."
                                rows="4"
                                value={formData.message}
                                onChange={handleChange}
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <div className="app-form-actions">
                        <button
                            type="button"
                            className="app-btn app-btn--ghost"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="app-btn app-btn--primary"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Submitting..." : "Submit Application"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ApplicationModal;
