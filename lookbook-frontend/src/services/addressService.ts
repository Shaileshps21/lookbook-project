import { api } from "./apiClient";

export interface Address {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export interface UpsertAddressInput {
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export const fetchMyAddresses = async (): Promise<Address[]> => {
  const { data } = await api.get<Address[]>("/addresses");
  return data;
};

export const createAddress = async (input: UpsertAddressInput): Promise<Address> => {
  const { data } = await api.post<Address>("/addresses", input);
  return data;
};

export const deleteAddressRequest = (id: string) => api.delete<null>(`/addresses/${id}`);

export const formatAddress = (a: Address) => `${a.line1}${a.line2 ? ", " + a.line2 : ""}, ${a.city}, ${a.state} ${a.pincode}`;
