export type SuccessResponse<T = any> = {
  data: T;
  message?: string;
  status: number;
  success: true;
};

export type ErrorResponse = {
  message: string;
  errors?: unknown[];
  status?: number;
  success: false;
};

export type Response<T = any> = SuccessResponse<T> | ErrorResponse;

export type TData = {
  [key: string]: any;
};

export type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
