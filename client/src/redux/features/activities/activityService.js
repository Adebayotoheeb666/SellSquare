import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const API_URL = `/api/products/`;

const getAllActivities = async (page = 1, limit = 10) => {
  const response = await axios.get(
    `/api/business/get-all-activities?page=${page}&limit=${limit}`
  );
  return response.data;
};

const activitiesService = {
  getAllActivities,
};

export default activitiesService;
