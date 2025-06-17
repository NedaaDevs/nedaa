import axios, { AxiosRequestConfig } from "axios";

// Types
import type { TData, RequestMethod, Response } from "@/types/api";

// Feedback
import NetworkStatusBanner from "@/components/feedback/NetworkStatusBanner";

import i18n from "@/localization/i18n";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

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

const validateApiUrl = (): boolean => {
  if (!API_URL) {
    console.error("API_URL is not defined in environment variables");
    return false;
  }
  return true;
};

const makeApiRequest = (
  method: RequestMethod,
  url: string,
  data: TData,
  contentType = "application/json"
): Promise<Response> => {
  // Check if API_URL is available before proceeding
  if (!validateApiUrl()) {
    return Promise.resolve({
      data: null,
      message: "API_URL is not configured",
      status: 0,
      success: false,
      errors: ["API configuration missing"],
    });
  }

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

      if (error.code === "NETWORK_ERROR" || error.code === "ERR_NETWORK") {
        message = "Network Error";
        NetworkStatusBanner.showOffline(i18n.t("network.messages.serverUnavailable"));
      } else if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
        message = "Request timeout";
        NetworkStatusBanner.showSlow(i18n.t("network.messages.timeout"));
      } else if (error.response) {
        message = error.response.data.message ? error.response.data.message : error.message;
        errors = error.response.data.errors ?? [];

        if (statusNumber >= 500) {
          NetworkStatusBanner.showError(i18n.t("network.messages.serverError"));
        } else if (statusNumber === 0) {
          NetworkStatusBanner.showOffline(i18n.t("network.messages.offline"));
        }
      } else {
        NetworkStatusBanner.showError(i18n.t("network.messages.error"));
      }

      return { message, status: statusNumber, success: false, errors };
    });
};

export const apiGet = <T = any>(url: string, params: TData = {}): Promise<Response<T>> =>
  makeApiRequest("GET", url, params);
