async function handleSignup(e) {
  e.preventDefault();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error(error);
    return;
  }

  const user = data.user;

  if (user) {
    const { error: profileError } = await supabase.from("Profiles").insert([
      {
        id: user.id,
        email: user.email,
        name,
        role,
      },
    ]);

    if (profileError) {
      console.error(profileError);
    }
  }
}
