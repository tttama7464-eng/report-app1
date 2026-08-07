import { getCategories } from "@/lib/actions/posts";
import { CreatePostForm } from "@/components/create/create-post-form";

export default async function CreatePage() {
  const categories = await getCategories();
  return <CreatePostForm categories={categories} />;
}
