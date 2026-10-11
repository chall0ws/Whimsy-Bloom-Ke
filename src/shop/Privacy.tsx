import type { ReactNode } from 'react'
import { BloomMark, HeartDivider } from '../components/Logo'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-2xl font-semibold text-green-ink">{title}</h2>
      {children}
    </section>
  )
}

/** Privacy policy. Also served at the plain address /privacy, which Google's sign-in setup links to. */
export function Privacy() {
  return (
    <article className="mx-auto max-w-2xl space-y-7 rounded-3xl border border-line bg-surface p-6 leading-relaxed text-ink-2 shadow-card sm:p-9 [&_li]:my-1 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5">
      <header className="text-center">
        <BloomMark size={48} className="mx-auto" />
        <h1 className="mt-3 font-display text-4xl font-semibold text-green-ink">Privacy policy</h1>
        <HeartDivider className="mx-auto mt-3 w-40" />
        <p className="mt-3 text-sm text-muted">Last updated: 11 October 2026</p>
      </header>

      <p>
        Whimsy &amp; Bloom is a small handmade flower business in Nairobi, Kenya. This page explains what information we collect when you
        use our website, why we need it, and the choices you have. We follow Kenya’s Data Protection Act, 2019.
      </p>

      <Section title="What we collect">
        <ul>
          <li>
            <strong>Order details:</strong> your name, phone number, delivery address, optional email, the bouquets you order and any wishes or
            card messages.
          </li>
          <li>
            <strong>Chat messages</strong> you send us through “Chat with us”.
          </li>
          <li>
            <strong>Your account</strong>, if you create one: your name and email address. If you sign in with Google, Google shares your name,
            email address and profile picture with us. We don’t get your Google password or access to anything else in your Google account.
          </li>
          <li>
            <strong>Payment records:</strong> whether an order is paid, the amount, the method (M-Pesa or card) and the payment reference.
          </li>
          <li>
            <strong>In your browser:</strong> your cart and a private key that lets you see orders you placed as a guest. These stay on your
            device.
          </li>
        </ul>
        <p>We don’t use advertising trackers, and we don’t sell your information.</p>
      </Section>

      <Section title="How we use it">
        <ul>
          <li>To make and deliver your order, and to contact you about it.</li>
          <li>To answer your messages.</li>
          <li>To let you track your orders and keep your details ready for next time, if you have an account.</li>
          <li>To keep basic business records, such as sales and payments.</li>
        </ul>
      </Section>

      <Section title="Payments">
        <p>
          Payments are handled by{' '}
          <a href="https://paystack.com/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-pink-ink underline">
            Paystack
          </a>
          . You enter your M-Pesa or card details on Paystack’s secure page, not on our website. We never see or store your card number or
          M-Pesa PIN.
        </p>
      </Section>

      <Section title="Who else sees your information">
        <ul>
          <li>
            <strong>Our team:</strong> the shop owner and the person who helps run the website.
          </li>
          <li>
            <strong>Couriers:</strong> your name, phone number and address, only to deliver your order.
          </li>
          <li>
            <strong>Service providers</strong> that run the website for us: Supabase (database and sign-in), Vercel (hosting), Paystack
            (payments) and Google (if you choose “Continue with Google”). They process information only to provide their service to us.
          </li>
        </ul>
        <p>We share information with authorities only if the law requires it.</p>
      </Section>

      <Section title="How long we keep it">
        <p>
          We keep order and payment records for as long as we need them for the business and for tax and accounting rules. Chat messages and
          account details are kept until you ask us to delete them.
        </p>
      </Section>

      <Section title="Your choices and rights">
        <p>
          You can see and update your details under{' '}
          <a href="#/account" className="font-medium text-pink-ink underline">
            My account
          </a>
          . You can also ask us to show you, correct or delete the information we hold about you, or object to how we use it. Just send us a
          message through{' '}
          <a href="#/chat" className="font-medium text-pink-ink underline">
            Chat with us
          </a>{' '}
          and we’ll reply as soon as we can. If you’re not happy with our answer, you can contact Kenya’s Office of the Data Protection
          Commissioner.
        </p>
      </Section>

      <Section title="Keeping it safe">
        <p>
          Your information is stored with access limited to our team, and our website only works over secure (HTTPS) connections. No system is
          perfect, but we take reasonable care to protect what you share with us.
        </p>
      </Section>

      <Section title="Changes">
        <p>If we change this policy, we’ll update this page and the date at the top.</p>
      </Section>
    </article>
  )
}
