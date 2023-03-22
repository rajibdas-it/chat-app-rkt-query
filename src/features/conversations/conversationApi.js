import apiSlice from "../api/apiSlice";
import { messagesApi } from "../messages/messagesApi";

export const conversationApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getConversations: builder.query({
      query: (email) =>
        `/conversations?participants_like=${email}&_sort=timestamp&_order=desc&_page=1&_limit=${process.env.REACT_APP_CONVERSATIONS_PER_PAGE}`,
    }),
    getConversation: builder.query({
      query: ({ userEmail, participantEmail }) =>
        `/conversations?participants_like=${userEmail}-${participantEmail}&&${participantEmail}-${userEmail}`,
    }),
    //add or edit conversation
    addConversation: builder.mutation({
      query: ({ sender, data }) => ({
        url: "/conversations",
        method: "POST",
        body: data,
      }),
      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        //optimistic update query start
        const pathResult2 = dispatch(
          apiSlice.util.updateQueryData(
            "getConversations",
            arg.sender,
            (draft) => {
              if (draft.length > 0) {
                draft.message.push(arg?.data?.message);
                draft.timestamp.push(arg?.data?.timestamp);
              }
            }
          )
        );
        //optimistic update query end
        try {
          const conversation = await queryFulfilled;
          // console.log(conversation);
          if (conversation?.data?.id) {
            const users = arg?.data?.users;
            const senderUser = users.find(
              (user) => user?.email === arg?.sender
            );
            const receiverUser = users.find(
              (user) => user?.email !== arg?.sender
            );
            dispatch(
              //message object start
              messagesApi.endpoints.addMessage.initiate({
                conversationId: conversation?.data?.id,
                sender: senderUser,
                receiver: receiverUser,
                message: arg.data.message,
                timestamp: arg.data.timestamp,
              })
              //message object end
            );
          }
        } catch (error) {
          pathResult2.undo();
        }
      },
    }),
    //
    editConversation: builder.mutation({
      query: ({ id, data, sender }) => ({
        url: `/conversations/${id}`,
        method: "PATCH",
        body: data,
      }),
      async onQueryStarted(arg, { queryFulfilled, dispatch }) {
        //optimistic cache update start
        const pathResult1 = dispatch(
          apiSlice.util.updateQueryData(
            "getConversations",
            arg.sender,
            (draft) => {
              const draftConversation = draft.find((c) => c.id == arg.id);
              draftConversation.message = arg.data.message;
              draftConversation.timestamp = arg.data.timestamp;
            }
          )
        );
        //optimistic cache update end
        try {
          const conversation = await queryFulfilled;
          // console.log(conversation);
          if (conversation?.data?.id) {
            const users = arg?.data?.users;
            const senderUser = users.find(
              (user) => user?.email === arg?.sender
            );
            const receiverUser = users.find(
              (user) => user?.email !== arg?.sender
            );
            dispatch(
              messagesApi.endpoints.addMessage.initiate({
                conversationId: conversation?.data?.id,
                sender: senderUser,
                receiver: receiverUser,
                message: arg.data.message,
                timestamp: arg.data.timestamp,
              })
            );
          }
        } catch (error) {
          pathResult1.undo();
        }
      },
    }),
  }),
});
// export default conversationApi.reducer;
export const {
  useGetConversationsQuery,
  useGetConversationQuery,
  useAddConversationMutation,
  useEditConversationMutation,
} = conversationApi;
