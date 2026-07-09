import type { Metadata } from "next"
import LegalPage from "@/components/LegalPage"

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of MarketFit.",
}

export default function TermsOfService() {
  return (
    <LegalPage title="Terms of Service" updated="June 30, 2026">
      <p className="note">
        <strong>Template notice:</strong> these terms are a starting point. Before public launch, have them
        reviewed by a qualified professional and confirm the company name, governing-law jurisdiction, and
        contact address are correct.
      </p>

      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of the MarketFit web app and
        Chrome extension (the &quot;Service&quot;). By creating an account or using the Service, you agree to
        these Terms. If you do not agree, do not use the Service.
      </p>

      <h2>1. The Service</h2>
      <p>
        MarketFit provides tools to tailor resumes, autofill job applications, search for visa-friendly roles,
        generate cover letters, prepare for interviews, and track applications. Features may change over time.
      </p>

      <h2>2. Eligibility &amp; accounts</h2>
      <ul>
        <li>You must be at least 16 years old and able to form a binding contract.</li>
        <li>You are responsible for your account credentials and for activity under your account.</li>
        <li>Provide accurate information and keep it current.</li>
      </ul>

      <h2>3. Your content</h2>
      <p>
        You retain ownership of the resumes, profile details, and other content you provide (&quot;Your
        Content&quot;). You grant MarketFit a limited license to host, process, and display Your Content solely
        to operate the Service for you (including sending the necessary text to our AI providers to generate
        your results, as described in our <a href="/privacy">Privacy Policy</a>). You are responsible for
        ensuring Your Content is accurate and lawful to use.
      </p>

      <h2>4. AI-generated output</h2>
      <p>
        MarketFit uses AI to generate resume edits, cover letters, scores, and suggestions. This output is a
        drafting aid, may contain errors, and is <strong>not</strong> career, legal, or immigration advice.
        You are responsible for reviewing everything before you submit it to an employer. MarketFit does not
        guarantee interviews, offers, sponsorship, or any specific job outcome.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Misrepresent your identity, qualifications, or work authorization to employers.</li>
        <li>Use the Service to send spam, scrape at scale, or violate any third-party site&apos;s terms.</li>
        <li>Reverse-engineer, disrupt, or attempt to gain unauthorized access to the Service.</li>
        <li>Upload content that is unlawful or infringes others&apos; rights.</li>
      </ul>

      <h2>6. The Chrome extension</h2>
      <p>
        The extension fills application forms from your saved profile and may tailor resumes for the role you
        are viewing. You are responsible for reviewing every field — especially legal attestations such as work
        authorization and visa sponsorship, which the extension never auto-answers on your behalf.
      </p>

      <h2>7. Subscriptions &amp; billing</h2>
      <ul>
        <li>Paid plans (e.g. Pro) are billed through Stripe on a recurring basis until cancelled.</li>
        <li>You can cancel anytime; access continues until the end of the current billing period.</li>
        <li>Except where required by law, fees are non-refundable. Prices may change with notice.</li>
      </ul>

      <h2>8. Third-party services</h2>
      <p>
        The Service links to and integrates third parties (e.g. Google, Stripe, job-listing providers, and the
        employers&apos; application sites). We are not responsible for their content, availability, or
        practices; your use of them is governed by their terms.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        The Service is provided &quot;as is&quot; and &quot;as available,&quot; without warranties of any kind,
        whether express or implied, including fitness for a particular purpose and non-infringement, to the
        fullest extent permitted by law.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, MarketFit will not be liable for any indirect, incidental,
        special, consequential, or punitive damages, or for lost opportunities, jobs, or data. Our total
        liability for any claim is limited to the amount you paid us in the 12 months before the claim.
      </p>

      <h2>11. Termination</h2>
      <p>
        You may stop using the Service and delete your account at any time. We may suspend or terminate access
        if you violate these Terms or to protect the Service and its users.
      </p>

      <h2>12. Changes</h2>
      <p>We may update these Terms and will revise the &quot;Last updated&quot; date. Continued use after changes means you accept them.</p>

      <h2>13. Governing law</h2>
      <p>These Terms are governed by the laws of [Your State/Country], without regard to conflict-of-law rules.</p>

      <h2>14. Contact</h2>
      <p>Questions: <a href="mailto:support@marketfit.app">support@marketfit.app</a>.</p>
    </LegalPage>
  )
}
