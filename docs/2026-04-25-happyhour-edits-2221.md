# Happyhour Edits

2024-04-25
\#happyhour

- Cookie consent UI
  - Silktide "S" is not visible
  - Please correct as per these Figma designs
    - [Light mode](https://www.figma.com/design/ykzuXYZ4gnogbNKZeV3Q1H/Happyhour-Design?node-id=280-4223&t=jlfdti5KKYN7kN9d-11)
    - [Dark mode](https://www.figma.com/design/ykzuXYZ4gnogbNKZeV3Q1H/Happyhour-Design?node-id=280-4306&t=jlfdti5KKYN7kN9d-11)
    - [Happy mode](https://www.figma.com/design/ykzuXYZ4gnogbNKZeV3Q1H/Happyhour-Design?node-id=280-4461&t=jlfdti5KKYN7kN9d-11)
- Buttons in both cookie consent UI and cookies prefs look incorrect
  - Not vertically centered; lower the text labels 1px
  - Default focus highlight is too strong; reduce to a 1 pixel stroke \#333333
  - Confirm correct font weight: should be Inter Bold 10pt
- Cookies pref
  - Close affordance "X"
    - Needs more left-padding to increase distance from the text at left from the "X"
    - Default focus around "X" is too strong
  - The rounded corners on the black bounding box should have a 15px corner radius to match the rounded corners on the sidebar
    - Double-check to be sure that the sidebar has 15px corner radii
- Header on mobile
  - The logo and "Happyhour" lockup are too large on ancillary pages, e.g., About, Privacy, Support
  - On these pages the logo and nameplate lockup should be identical in size and placement to the header on the home page, so that there is no variation or "movement" of these elements when the user is at the top of the scroll and goes back and forth between any ancillary page and the home page
- Copywriting on ancillary pages
  - On the Privacy page, change "send an email" to say "send us an email"
  - On the Support page, change "send an email" to say "send us an email"
  - In the body paragraphs on the Privacy, About and Support pages, all bold text should be a link
    - "Happyhour" → https://happyhour.day
    - "Clerk" → https://clerk.com
    - "Cloudlfare D1" → https://cloudflare.com
    - "DesignDept.com" → https://designdept.com
    - "send us an email" → mailto://hellodesigndept@gmail.com
  - Hover state on all text links should be \#3B82F6
  - Only the link "send us an email" should have an underline
- Favicon
  - Is the new favicon implemented? It's not showing up in mobile Safari or Chrome
