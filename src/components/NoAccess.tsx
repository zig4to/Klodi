import Logo from "@/components/Logo";

export default function NoAccess() {
  return (
    <div className="mx-auto max-w-sm py-16 text-center">
      <Logo className="mx-auto mb-4 h-14 w-14" />
      <h1 className="text-xl font-semibold">Ni dostopa</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Klodi ti mora odobriti skrbnik v Bitneverse.
      </p>
    </div>
  );
}
