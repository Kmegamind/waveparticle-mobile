import { Breadcrumb } from "@/app/admin/admin-ui";

// The content admin's first page (#287). The pages themselves arrive with their own issues.
export default function AdminOverview() {
  return (
    <>
      <Breadcrumb items={[{ label: "Overview" }]} />
      <h1>Overview</h1>
      <p className="admin-lede">
        Edit the app&apos;s content here without a deploy. Choose a page from the menu.
      </p>
    </>
  );
}
