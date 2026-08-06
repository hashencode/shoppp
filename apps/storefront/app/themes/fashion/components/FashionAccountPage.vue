<script setup lang="ts">
const emit = defineEmits<{ submit: [label: string] }>();
</script>

<template>
  <section class="fashion-account-page">
    <form class="fashion-account-login" @submit.prevent="emit('submit', 'Member login')">
      <h2>Member login</h2>
      <label
        ><span>Username or email address <b>*</b></span
        ><input required type="email" placeholder="Enter your username"
      /></label>
      <label
        ><span>Password <b>*</b></span
        ><input required type="password" placeholder="Enter your password"
      /></label>
      <div class="fashion-account-options">
        <label><input type="checkbox" />Remember me</label>
        <NuxtLink to="/account">Forget your password?</NuxtLink>
      </div>
      <button type="submit">Login</button>
    </form>

    <form class="fashion-account-register" @submit.prevent="emit('submit', 'Account registration')">
      <h2>Create an account</h2>
      <label
        ><span>Username <b>*</b></span
        ><input required placeholder="Enter your username"
      /></label>
      <label
        ><span>Email address <b>*</b></span
        ><input required type="email" placeholder="Enter your email"
      /></label>
      <label
        ><span>Password <b>*</b></span
        ><input required type="password" placeholder="Enter your password"
      /></label>
      <p>
        Your personal data will be used to support your experience throughout this website, to
        manage access to your account, and for other purposes described in our
        <NuxtLink to="/policies/privacy">privacy policy.</NuxtLink>
      </p>
      <button type="submit">Register</button>
    </form>
  </section>
</template>
