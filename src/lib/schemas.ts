import { z } from "zod";

const URL_PATTERN = /https?:\/\/\S+/g;

const slug = z
  .string()
  .min(1)
  .max(100)
  .regex(
    /^[a-z0-9][a-z0-9-]*$/,
    "slug must be lowercase alphanumerics + hyphen",
  );

export const postStatus = z.enum(["draft", "published"]);
export type PostStatus = z.infer<typeof postStatus>;

export const createPostBody = z.object({
  title: z.string().min(1).max(200),
  slug,
  content_md: z.string().min(1),
  status: postStatus.default("draft"),
});
export type CreatePostBody = z.infer<typeof createPostBody>;

export const updatePostBody = z.object({
  title: z.string().min(1).max(200).optional(),
  content_md: z.string().min(1).optional(),
  status: postStatus.optional(),
});
export type UpdatePostBody = z.infer<typeof updatePostBody>;

export const postIdParam = z.object({ id: z.string().uuid() });

export const createCommentBody = z
  .object({
    author_name: z.string().min(1).max(50),
    body: z.string().min(1).max(2000),
    turnstileToken: z.string().min(1),
    // honeypot: 値が入っていたら silent drop。空文字列か未送信のみ通す
    website: z.string().max(0).optional().default(""),
  })
  .refine(
    (input) => {
      const matches = input.body.match(URL_PATTERN);
      return !matches || matches.length <= 2;
    },
    { message: "too many urls", path: ["body"] },
  );
export type CreateCommentBody = z.infer<typeof createCommentBody>;

export const commentIdParam = z.object({ id: z.string().uuid() });

export const postSlugParam = z.object({ slug });

export const inviteEditorBody = z.object({
  email: z.string().email().max(254),
  role: z.enum(["admin", "editor"]),
  display_name: z.string().min(1).max(80),
});
export type InviteEditorBody = z.infer<typeof inviteEditorBody>;
