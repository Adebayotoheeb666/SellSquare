import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
    getBriefByToken,
    submitBriefResponses,
} from "../../../services/applicationService";
import { Helmet } from "react-helmet";
import "./BriefPage.scss";

const BriefPage = () => {
    const { token } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [brief, setBrief] = useState(null);
    const [status, setStatus] = useState("");
    const [form, setForm] = useState({
        campaignIdea: "",
        channelPlan: "",
        measurementPlan: "",
        links: "",
    });
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const data = await getBriefByToken(token);
                setBrief(data);
                setStatus(data?.status || "");
                if (data?.status === "submitted") {
                    setSubmitted(true);
                }
            } catch (err) {
                setError("Brief not found or expired.");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await submitBriefResponses(token, form);
            setSubmitted(true);
        } catch (err) {
            // errors toasts handled in service
        } finally {
            setSubmitting(false);
        }
    };

    if (loading)
        return (
            <div className="brief_page">
                <p>Loading brief...</p>
            </div>
        );
    if (error)
        return (
            <div className="brief_page">
                <p>{error}</p>
            </div>
        );
    if (submitted)
        return (
            <div className="brief_page">
                <div className="brief_submitted_card">
                    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="36" cy="36" r="36" fill="#e9f5ee" />
                        <path d="M24 36.5L32.5 45L48 27" stroke="#2f7040" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <h2>Brief submitted</h2>
                    <p>Thanks for sending this in. We’ll review and follow up by email.</p>
                </div>
            </div>
        );

    return (
        <div className="brief_page">
            <Helmet>
                <title>SellSquare | Internship Brief</title>
                <meta name="robots" content="noindex, nofollow" />
            </Helmet>
            <div className="brief_card">
                <div className="brief_header">
                    <div>
                        <p className="brief_kicker">Marketing Internship</p>
                        <h1>Complete your brief</h1>
                        <p className="brief_meta">
                            For {brief?.applicant?.name} · {brief?.applicant?.position}
                        </p>
                    </div>
                    {brief?.dueDate && (
                        <div className="brief_due">
                            Due {new Date(brief.dueDate).toDateString()}
                        </div>
                    )}
                </div>

                {brief?.instructions && (
                    <div className="brief_note">
                        <h4>Notes from the team</h4>
                        <p>{brief.instructions}</p>
                    </div>
                )}

                <div className="brief_guidance">
                    <div>
                        <p className="guidance_label">What to cover</p>
                        <ul>
                            {(brief?.questions || []).map((q, idx) => (
                                <li key={idx}>{q}</li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <p className="guidance_label">Hints</p>
                        <ul>
                            <li>Keep it concise; bullet points are great.</li>
                            <li>Show how you’d measure success for the objective.</li>
                            <li>Add links to any mock assets or past work (optional).</li>
                        </ul>
                    </div>
                </div>

                <form className="brief_form" onSubmit={handleSubmit}>
                    <label>
                        Campaign idea (max 200 words)
                        <textarea
                            required
                            rows="4"
                            value={form.campaignIdea}
                            onChange={(e) =>
                                setForm({ ...form, campaignIdea: e.target.value })
                            }
                        />
                    </label>
                    <label>
                        Channel plan
                        <textarea
                            required
                            rows="4"
                            value={form.channelPlan}
                            onChange={(e) =>
                                setForm({ ...form, channelPlan: e.target.value })
                            }
                        />
                    </label>
                    <label>
                        Measurement plan
                        <textarea
                            required
                            rows="3"
                            value={form.measurementPlan}
                            onChange={(e) =>
                                setForm({ ...form, measurementPlan: e.target.value })
                            }
                        />
                    </label>
                    <label>
                        Links to work or mock assets (optional)
                        <input
                            type="text"
                            value={form.links}
                            onChange={(e) => setForm({ ...form, links: e.target.value })}
                        />
                    </label>

                    <div className="brief_actions">
                        <button type="submit" disabled={submitting}>
                            Submit brief
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BriefPage;
