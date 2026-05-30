GRANT SELECT ON public.chat_participants TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.messages TO authenticated;
GRANT SELECT ON public.chats TO authenticated;
GRANT UPDATE ON public.chat_participants TO authenticated;
GRANT INSERT ON public.messages TO authenticated;