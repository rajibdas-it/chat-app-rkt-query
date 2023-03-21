import apiSlice from "../api/apiSlice";

const useApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query({
      query: (email) => `/users?email=${email}`,
    }),
  }),
});

export const { useGetUsersQuery } = useApi;
