import React, { useEffect, useState } from "react";
import "./OfflineIndicator.css";

const OfflineIndicator = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showNotification, setShowNotification] = useState(false);
    const [justCameOnline, setJustCameOnline] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setJustCameOnline(true);

            // Show "Back Online" message for 3 seconds then hide
            setTimeout(() => {
                setShowNotification(false);
                setJustCameOnline(false);
            }, 3000);
        };

        const handleOffline = () => {
            setIsOnline(false);
            setShowNotification(true);
            setJustCameOnline(false);
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        // Set initial state
        if (!navigator.onLine) {
            setShowNotification(true);
        }

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    // Don't show anything if online and not just came online
    if (isOnline && !justCameOnline) {
        return null;
    }

    // Show notification if offline or just came online
    if (!isOnline || (justCameOnline && showNotification)) {
        return (
            <div className={`offline-indicator ${isOnline ? "online" : "offline"}`}>
                <div className="offline-indicator-content">
                    {isOnline ? (
                        <>
                            <svg
                                className="offline-icon online-icon"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <span className="offline-text">Back Online</span>
                        </>
                    ) : (
                        <>
                            <svg
                                className="offline-icon"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21.192 21.192M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
                                />
                            </svg>
                            <span className="offline-text">No Internet Connection</span>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return null;
};

export default OfflineIndicator;
