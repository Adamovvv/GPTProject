create index if not exists comments_author_id_idx on public.comments(author_id);
create index if not exists content_reports_comment_id_idx on public.content_reports(comment_id);
create index if not exists content_reports_post_id_idx on public.content_reports(post_id);
create index if not exists content_reports_reporter_id_idx on public.content_reports(reporter_id);
create index if not exists issues_author_id_idx on public.issues(author_id);
create index if not exists post_likes_user_id_idx on public.post_likes(user_id);
create index if not exists posts_author_id_idx on public.posts(author_id);
