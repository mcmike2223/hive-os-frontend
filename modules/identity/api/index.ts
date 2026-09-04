import api from "@/modules/shared/api/http";

export { api };

type ApiSuccessEnvelope<T> = {
  success: true;
  message?: string;
  data: T;
};

function unwrapApiResponse<T>(response: { data: T | ApiSuccessEnvelope<T> }): T {
  const body = response.data;

  if (
    body &&
    typeof body === "object" &&
    "success" in body &&
    (body as ApiSuccessEnvelope<T>).success === true &&
    "data" in body
  ) {
    return (body as ApiSuccessEnvelope<T>).data;
  }

  return body as T;
}

export const getProfile = async () => unwrapApiResponse(await api.get("/user"));
export const fetchUsers = async (params: any) => unwrapApiResponse(await api.get("/users", { params }));
export const createUser = async (data: FormData | any) => unwrapApiResponse(await api.post("/users", data));
export const updateUser = async ({ id, formData }: { id: number; formData: FormData | any }) => {
  if (formData instanceof FormData) {
    formData.set("_method", "PUT");
  } else {
    formData = { ...formData, _method: "PUT" };
  }

  return unwrapApiResponse(await api.post(`/users/${id}`, formData));
};
export const deleteUser = async (id: number) => unwrapApiResponse(await api.delete(`/users/${id}`));
export const toggleUserStatus = async (id: number) => unwrapApiResponse(await api.post(`/users/${id}/toggle-status`));
export const verify2FA = async (data: any) => (await api.post("/verify-2fa", data)).data;
export const fetchRoles = async (params: any = {}) => (await api.get("/roles", { params })).data;
export const createRole = async (data: any) => (await api.post("/roles", data)).data;
export const updateRole = async ({ id, data }: { id: string | number; data: any }) => (await api.put(`/roles/${id}`, data)).data;
export const deleteRole = async (id: string | number) => (await api.delete(`/roles/${id}`)).data;
export const fetchPermissions = async () => (await api.get("/permissions")).data;

export default api;
