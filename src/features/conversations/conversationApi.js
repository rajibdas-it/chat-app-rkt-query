import apiSlice from "../api/apiSlice";
import { messagesApi } from "../messages/messagesApi";
import io from "socket.io-client";

export const conversationApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getConversations: builder.query({
      query: (email) =>
        `/conversations?participants_like=${email}&_sort=timestamp&_order=desc&_page=1&_limit=${process.env.REACT_APP_CONVERSATIONS_PER_PAGE}`,
      async onCacheEntryAdded(
        arg,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved }
      ) {
        //create socket
        const socket = io("http://localhost:9000", {
          reconnectionDelay: 1000,
          reconnection: true,
          reconnectionAttempts: 10,
          transports: ["websocket"],
          agent: false,
          upgrade: false,
          rejectUnauthorized: false,
        });
        try {
          await cacheDataLoaded;
          socket.on("converstation", (data) => {
            updateCachedData((draft) => {
              const conversation = draft.find((c) => c.id === data?.data?.id);
              if (conversation) {
                conversation.message = data.data.message;
                conversation.timestamp = data.data.timestamp;
              } else {
                //conversation.push(data?.data);
              }
            });
          });
        } catch (error) {}
      },
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
        // console.log(arg);
        // console.log(arg.data.message);
        // console.log(arg.data.timestamp);
        //optimistic update query start
        const pathResult2 = dispatch(
          apiSlice.util.updateQueryData(
            "getConversations",
            undefined,
            arg.sender,
            (draft) => {
              draft.push(arg);
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
          // console.log(error);
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
        const pathResult = dispatch(
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
            const res = await dispatch(
              messagesApi.endpoints.addMessage.initiate({
                conversationId: conversation?.data?.id,
                sender: senderUser,
                receiver: receiverUser,
                message: arg.data.message,
                timestamp: arg.data.timestamp,
              })
            ).unwrap();

            //update messages cache pessimistically start
            dispatch(
              apiSlice.util.updateQueryData(
                "getMessages",
                res.conversationId.toString(),
                (draft) => {
                  draft.push(res);
                }
              )
            );
            //update messages cache pessimistically end
          }
        } catch (error) {
          pathResult.undo();
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
