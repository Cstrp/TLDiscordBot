import axios from 'axios';

export const fetchPage = async (url: string): Promise<string> => {
  try {
    const { data } = await axios.get<string>(url);

    return data;
  } catch (error) {
    throw error;
  }
};
