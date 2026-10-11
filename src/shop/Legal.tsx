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

const link = 'font-medium text-pink-ink underline'

/** The frame shared by the privacy policy and the terms of service. */
function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl space-y-7 rounded-3xl border border-line bg-surface p-6 leading-relaxed text-ink-2 shadow-card sm:p-9 [&_li]:my-1 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5">
      <header className="text-center">
        <BloomMark size={48} className="mx-auto" />
        <h1 className="mt-3 font-display text-4xl font-semibold text-green-ink">{title}</h1>
        <HeartDivider className="mx-auto mt-3 w-40" />
        <p className="mt-3 text-sm text-muted">Last updated: {updated}</p>
      </header>
      {children}
    </article>
  )
}

/** Privacy policy. Also served at the plain address /privacy, which Google's sign-in setup links to. */
export function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="11 October 2026">

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
          <a href="https://paystack.com/privacy" target="_blank" rel="noopener noreferrer" className={link}>
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
          <a href="#/account" className={link}>
            My account
          </a>
          . You can also ask us to show you, correct or delete the information we hold about you, or object to how we use it. Just send us a
          message through{' '}
          <a href="#/chat" className={link}>
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
    </LegalPage>
  )
}

/** Terms of service. Also served at the plain address /terms. */
export function Terms() {
  return (
    <LegalPage title="Terms of service" updated="11 October 2026">
      <p>
        These terms apply when you shop at Whimsy &amp; Bloom, a handmade flower business in Nairobi, Kenya. By placing an order, you agree to
        them. If anything here is unclear, just ask us through{' '}
        <a href="#/chat" className={link}>
          Chat with us
        </a>
        .
      </p>

      <Section title="Our bouquets">
        <ul>
          <li>Every bouquet is made by hand, so yours may differ slightly from the pictures in shape, shade or arrangement.</li>
          <li>
            If you ask for particular colours or a card message, we’ll follow your wishes as closely as we can. If something you asked for isn’t
            available, we’ll check with you first.
          </li>
          <li>Prices are in Kenyan shillings (KES) and are shown before you pay.</li>
        </ul>
      </Section>

      <Section title="Ordering and paying">
        <ul>
          <li>You don’t need an account to order. If you create one, keep your sign-in details to yourself.</li>
          <li>
            Every order starts with a <strong>50% deposit</strong> of the bouquet price, paid with M-Pesa or card through{' '}
            <a href="https://paystack.com" target="_blank" rel="noopener noreferrer" className={link}>
              Paystack
            </a>
            . We start making your bouquet once the deposit is confirmed. An order without a deposit isn’t reserved.
          </li>
          <li>
            When your bouquet is ready, we’ll message you with the <strong>balance</strong>: the other 50% plus the delivery fee. You pay it from
            your order page, and we send your order once it’s paid.
          </li>
          <li>We may decline or cancel an order, for example if a price was shown wrongly. If you’ve already paid, we’ll refund you in full.</li>
        </ul>
      </Section>

      <Section title="Delivery">
        <ul>
          <li>
            At checkout you choose <strong>within Nairobi</strong> (collect from a Pickup Mtaani agent, or a rider to your door),{' '}
            <strong>outside Nairobi</strong> (sent with the bus service you name) or <strong>outside Kenya</strong> (by courier). We confirm the
            delivery fee when your order is ready, and it’s added to the balance before you pay it.
          </li>
          <li>
            Parcels sent by bus or Pickup Mtaani are collected by you from the bus office or agent. Once we’ve handed your order to them,
            please follow up with them on collection. Orders sent outside Kenya may be subject to customs duties in your country, which you
            pay.
          </li>
          <li>
            Please give a correct address and a phone number we can reach. If we can’t deliver because of wrong details or nobody being
            available, we’ll contact you to arrange another delivery, which may cost extra.
          </li>
          <li>Delivery times are our best estimate. We’ll keep you posted in the chat if anything changes.</li>
        </ul>
      </Section>

      <Section title="Cancellations and refunds">
        <ul>
          <li>
            <strong>The deposit is non-refundable.</strong> If you cancel before your order is sent, we keep the deposit and refund anything
            you paid on top of it.
          </li>
          <li>
            <strong>Once your order has been sent</strong>, it can’t be cancelled. If there’s a problem with it, tell us as soon as possible
            through the chat, ideally with a photo. If we agree to a refund, we refund the price of the bouquets. The delivery fee isn’t
            refundable once the order has been sent.
          </li>
          <li>Refunds go back the way you paid (M-Pesa or card).</li>
        </ul>
      </Section>

      <Section title="Using the website and chat">
        <p>
          Please use the website and chat for genuine orders and questions, and be kind to our team. We may close an account or stop a chat
          that’s used to abuse, spam or deceive.
        </p>
      </Section>

      <Section title="Our responsibility">
        <p>
          We take care with every bouquet and every delivery. We aren’t responsible for delays or problems caused by things outside our
          control, such as severe weather, road closures or courier and network outages. Nothing in these terms takes away your rights under
          Kenyan consumer protection law.
        </p>
      </Section>

      <Section title="Your information">
        <p>
          How we handle your details is explained in our{' '}
          <a href="#/privacy" className={link}>
            privacy policy
          </a>
          .
        </p>
      </Section>

      <Section title="Changes and the law">
        <p>
          We may update these terms from time to time; the version on this page when you place an order is the one that applies to it. These
          terms are governed by the laws of Kenya.
        </p>
      </Section>
    </LegalPage>
  )
}
