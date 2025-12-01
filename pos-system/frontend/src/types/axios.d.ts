import 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    __suppressGlobalError?: boolean;
  }
}

