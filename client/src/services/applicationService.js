import axios from "axios";
import { toast } from "sonner";
import { BACKEND_URL } from "../config/apiConfig";

const getErrorMessage = (error) => {
  if (error.response && error.response.data) {
    return error.response.data.message || JSON.stringify(error.response.data);
  }
  return error.message || "An unexpected error occurred";
};

export const fetchApplications = async () => {
  try {
    const res = await axios.get(`${BACKEND_URL}/api/apply`);
    return res.data?.data || [];
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

export const updateApplicationStatus = async (id, status) => {
  try {
    const res = await axios.patch(`${BACKEND_URL}/api/apply/${id}/status`, {
      status,
    });
    toast.success("Status updated");
    return res.data?.data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

export const sendBrief = async (id, payload) => {
  try {
    const res = await axios.post(
      `${BACKEND_URL}/api/apply/${id}/brief`,
      payload,
    );
    toast.success("Brief sent");
    return res.data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

export const sendFollowUpEmail = async (id, payload) => {
  try {
    // Check if we have attachments - if so, use FormData
    const hasAttachments =
      payload.attachments && payload.attachments.length > 0;

    let res;
    if (hasAttachments) {
      // Use FormData for multipart/form-data
      const formData = new FormData();
      formData.append("subject", payload.subject);
      formData.append("message", payload.message);

      // Append each attachment
      for (const file of payload.attachments) {
        formData.append("attachments", file);
      }

      res = await axios.post(`${BACKEND_URL}/api/apply/${id}/email`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
    } else {
      // Standard JSON request for text-only emails
      res = await axios.post(`${BACKEND_URL}/api/apply/${id}/email`, payload);
    }

    toast.success(res.data?.message || "Email sent");
    return res.data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

export const getBriefByToken = async (token) => {
  try {
    const res = await axios.get(`${BACKEND_URL}/api/apply/brief/${token}`);
    return res.data?.data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};

export const submitBriefResponses = async (token, payload) => {
  try {
    const res = await axios.post(
      `${BACKEND_URL}/api/apply/brief/${token}/submit`,
      payload,
    );
    toast.success("Brief submitted");
    return res.data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    throw error;
  }
};
