// Checks that the Supabase project in .env answers. Prints only OK or FAIL, never the values.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log("FAIL: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing in .env");
  process.exit(1);
}

try {
  const response = await fetch(new URL("/auth/v1/health", url), { headers: { apikey: key } });
  if (response.ok) {
    console.log("OK: the Supabase project answered and accepted the public key.");
  } else {
    console.log(
      `FAIL: the project answered with status ${response.status}. Check the key and the project URL.`,
    );
    process.exit(1);
  }
} catch {
  console.log("FAIL: could not reach the project. Check the URL and your network.");
  process.exit(1);
}
