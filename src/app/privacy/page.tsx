import type { Metadata } from "next"
import LegalPage from "@/components/LegalPage"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How MarketFit collects, uses, and protects your data.",
}

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy" updated="June 30, 2026">
      <p className="note">
        <strong>Template notice:</strong> this policy is a starting point that reflects how MarketFit
        currently handles data. Before public launch, have it reviewed by a qualified professional and
        confirm the company name, governing jurisdiction, and contact address below are correct.
      </p>

      <p>
        MarketFit (&quot;MarketFit,&quot; &quot;we,&quot; &quot;us&quot;) helps job seekers tailor resumes,
        autofill applications, find visa-friendly roles, and track their job search. This policy explains
        what we collect, why, and the choices you have. By using the MarketFit web app or Chrome extension,
        you agree to this policy.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li><strong>Account information</strong> — name, email, and authentication details when you sign up (via email magic link or Google sign-in).</li>
        <li><strong>Resume &amp; profile data</strong> — resumes you upload, and the contact, work-history, skills, education, work-authorization/visa status, and salary preferences you enter or that we extract from your resume.</li>
        <li><strong>Job-search activity</strong> — jobs you save, applications you track, tailoring requests, cover letters, and interview-prep notes.</li>
        <li><strong>Gmail data (optional, only if you connect it)</strong> — read-only access to message metadata and content needed to surface recruiter emails and replies. See the Google disclosure in §4.</li>
        <li><strong>Payment information</strong> — if you subscribe, payments are processed by Stripe. We do not store full card numbers.</li>
        <li><strong>Usage &amp; device data</strong> — basic logs and analytics needed to operate and secure the service.</li>
      </ul>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To provide the core features: resume tailoring, ATS scoring, autofill, job matching, cover letters, interview prep, and application tracking.</li>
        <li>To personalize results (e.g. match jobs to your profile and visa needs).</li>
        <li>To process payments and manage subscriptions.</li>
        <li>To maintain security, prevent abuse, and comply with the law.</li>
      </ul>
      <p>We do <strong>not</strong> sell your personal information, and we do not use your data to train our own or third parties&apos; AI models.</p>

      <h2>3. AI processing</h2>
      <p>
        To tailor resumes, write cover letters, and prep for interviews, the relevant text (your resume
        content and the job description you provide) is sent to our AI providers — <strong>Anthropic</strong>{" "}
        and <strong>OpenRouter</strong> — solely to generate your result. These providers process the text on
        our behalf and do not use it to train their models when accessed through our API. We send only what is
        needed for the feature you requested.
      </p>

      <h2>4. Google user data &amp; Limited Use disclosure</h2>
      <p>
        If you choose to connect Gmail, MarketFit requests the <strong>read-only</strong> Gmail scope to find
        and display recruiter-related emails inside your dashboard. MarketFit&apos;s use and transfer of
        information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Google API Services User Data Policy
        </a>, including the <strong>Limited Use</strong> requirements. Specifically:
      </p>
      <ul>
        <li>We only use Gmail data to provide and improve the in-app recruiter-email features you enabled.</li>
        <li>We do <strong>not</strong> transfer or sell Gmail data, and do <strong>not</strong> use it for advertising.</li>
        <li>We do <strong>not</strong> use Gmail data to train generalized AI/ML models.</li>
        <li>Humans do not read your Gmail data except where you ask for support, for security, or as required by law.</li>
        <li>You can disconnect Gmail at any time in Settings, and revoke access from your{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">Google Account permissions</a>.</li>
      </ul>

      <h2>5. The Chrome extension</h2>
      <p>
        The MarketFit extension reads the job-application form on the page you are viewing so it can fill it
        from <em>your</em> saved profile, and (when you ask) can tailor a resume for that role. It does not
        read pages unrelated to job applications, does not sell data, and never auto-answers legal questions
        such as visa-sponsorship attestations — those are always left for you to confirm.
      </p>

      <h2>6. Third-party services</h2>
      <p>We share data with service providers strictly to run MarketFit:</p>
      <ul>
        <li><strong>Supabase</strong> — authentication, database, and file storage.</li>
        <li><strong>Anthropic</strong> and <strong>OpenRouter</strong> — AI text generation (see §3).</li>
        <li><strong>Google</strong> — sign-in and optional Gmail access (see §4).</li>
        <li><strong>Stripe</strong> — payment processing.</li>
        <li><strong>Job data providers</strong> (e.g. JSearch/RapidAPI, Adzuna, USAJobs) — to fetch public job listings; we send search terms, not your identity.</li>
      </ul>

      <h2>7. Data retention</h2>
      <p>
        We keep your data while your account is active. You can delete individual resumes and applications in
        the app, and you can request deletion of your entire account and associated data by emailing us. We may
        retain limited records where required for legal, security, or accounting reasons.
      </p>

      <h2>8. Security</h2>
      <p>
        We use industry-standard measures (encrypted transport, access controls, and reputable infrastructure
        providers) to protect your data. No method of transmission or storage is 100% secure, but we work to
        protect your information and limit access to it.
      </p>

      <h2>9. Your rights &amp; choices</h2>
      <ul>
        <li>Access, correct, export, or delete your data.</li>
        <li>Disconnect Gmail or revoke Google access at any time.</li>
        <li>Cancel your subscription at any time.</li>
        <li>Depending on where you live (e.g. EEA/UK/California), you may have additional rights; contact us to exercise them.</li>
      </ul>

      <h2>10. Children</h2>
      <p>MarketFit is not directed to anyone under 16, and we do not knowingly collect data from children.</p>

      <h2>11. Changes</h2>
      <p>We may update this policy and will revise the &quot;Last updated&quot; date above. Material changes will be communicated in-app or by email.</p>

      <h2>12. Contact</h2>
      <p>Questions or requests: <a href="mailto:support@marketfit.app">support@marketfit.app</a>.</p>
    </LegalPage>
  )
}
