import axios, { AxiosRequestConfig } from "axios";

// Types
import type { TData, RequestMethod, Response } from "@/types/api";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("API URL Not set");
}

const apiInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  validateStatus: (status) => status >= 200 && status < 300,
});

const makeApiRequest = (
  method: RequestMethod,
  url: string,
  data: TData,
  contentType = "application/json",
): Promise<Response> => {
  const params = new URLSearchParams(data).toString();

  const config: AxiosRequestConfig = {
    method,
    url: `${API_URL}${url}${method === "GET" ? (params.length ? `?${params}` : "") : ""}`,
    headers: {
      "Content-Type": contentType,
      Accept: "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    validateStatus: function (status: number) {
      return status >= 200 && status < 300;
    },
  };

  if (method !== "GET") {
    data.data = data;
  }

  return apiInstance(config)
    .then((response) => {
      const statusNumber = response.status;
      const success = statusNumber >= 200 && statusNumber < 300;
      const { data: responseData, message: responseMessage } = response.data;
      return {
        data: responseData,
        message: responseMessage,
        status: statusNumber,
        success,
      } as Response;
    })
    .catch((error) => {
      let message = error?.response?.data.message;
      const statusNumber = error?.response?.status;
      let errors = [];

      if (error.isNetworkError) {
        message = "Network Error";
      } else if (error.response) {
        message = error.response.data.message
          ? error.response.data.message
          : error.message;
        errors = error.response.data.errors ?? [];
      }

      return { message, status: statusNumber, success: false, errors };
    });
};

export const apiGet = <T = any>(
  url: string,
  params: TData = {},
): Promise<Response<T>> => makeApiRequest("GET", url, params);
