# Named organizations: labels, corrections and takedown (DRAFT)

Status: draft for the owner's approval. Not published. Once approved, the "Public text" section goes
on the methodology page under "Claims from criminal groups", and BACKLOG Phase 1 ticks the item.

## What we show today

- Organizations named in official disclosures: SEC 8-K Item 1.05 filings, state attorney general
  breach notices (WA, CA), Have I Been Pwned breach entries, and agency advisories.
- No ransomware leak-site victim names. ransomware.live stays blocked until written approval.

## Rules for agents and the pipeline

1. **Label by source type.** An official filing or notice is shown as "reported by <source>". A
   leak-site listing, if we ever show one, is always "Claimed by <group>. Not confirmed." It never
   confirms damage on its own (ladder rule: claims never set rung 5).
2. **Name only what the source names.** No inferred victims, no guessing a company from a product,
   no linking a person to an incident.
3. **Link and date every name.** Each named organization links to the filing or notice, with its date.
4. **No stolen data.** Never link to leaked files, samples or leak-site pages. Link to the group's
   name and the claim date only.
5. **Age out claims.** A claim with no official confirmation after 90 days drops off the home page
   and stays on its event page marked "unconfirmed after 90 days".

## Correction and takedown requests

- Anyone can write to jp@jessepike.dev. We answer within 2 business days.
- **Factual error** (wrong name, wrong date, wrong link): fix it, then log a dated entry on
  /corrections.
- **Request to remove an accurate official disclosure:** we keep it. Public filings stay public.
  We will add the organization's own statement or a link to it if they send one.
- **Request to remove a leak-site claim:** we remove the name within 2 business days and keep an
  anonymized entry ("a US healthcare organization"), unless an official source later confirms it.
- **Legal process** (court order, valid legal demand): the owner decides. Agents never remove or
  restore content on a legal demand without the owner.
- Every removal is logged in the admin audit log with the reason. Public corrections log entries
  never name the requester.

## Public text (for the methodology page once approved)

> **Named organizations.** We name an organization only when an official source names it: a
> regulatory filing, a breach notice or a government advisory. Each name links to that source and
> its date. Ransomware leak sites list victims too. Those are claims by criminal groups. Some are
> false or old. If we show one, we label it as a claim, we never treat it as proof of damage, and we
> never link to stolen data.
>
> **Corrections and removals.** If something about your organization is wrong, write to
> jp@jessepike.dev. We reply within 2 business days, fix errors, and log every correction on the
> corrections page. We remove unconfirmed claims on request. We keep accurate public filings, and
> we will link to your own statement if you send one.
