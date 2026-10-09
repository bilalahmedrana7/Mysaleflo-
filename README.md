# My Saleflo

Sales, orders, invoices, stock, ledger, payments and reports for distributors.

## Run
```
npm install
npm run dev        # development (demo data + demo logins enabled)
npm test           # business-logic and production-seed tests
npm run lint       # type check
npm run build && NODE_ENV=production SUPER_ADMIN_PASSWORD='...' npm start
```

## Production notes (Phase 10)
- Demo logins, "Reset data" and audit/test screens exist **only in development builds**.
- Test API routes (`/test-phase*`, `/security/run-tests`) return 404 in production.
- Production seeds only the Super Admin (password from `SUPER_ADMIN_PASSWORD`).
- Login is locked for 15 minutes after 5 failed attempts (per login + IP).
- New dealer / order-taker passwords must be at least 8 characters; there are no default passwords.
- Dealers can download/restore a backup from **Subscription & Info**.

## Data storage (Phase 11)
- Accounts, dealers and server-side records are saved in a SQLite file (`DATA_DIR`, default `./data/saleflo.db`) and survive restarts.
- A dealer's business data is saved on the server (versioned) after every change and loaded on login, so the dealer can open the app on another phone or computer and see the same data. The header shows **Saved / Saving / Offline**. The dealer's screen also checks the server every 20 seconds, so orders placed by order takers appear without reloading.
- If the same dealer changes data on two devices at once, the second save is refused and the latest server copy is loaded with a notice (nothing is silently overwritten).
- **Order Takers** log in with accounts created by the dealer (the server issues the account ID). They receive a safe view of the dealer's data (no buy prices, profit, expenses or other people's orders). Their orders are sent to the server, which confirms them: it uses the dealer's catalogue price, cuts stock, numbers the invoice and updates the customer ledger, so many phones can sell at once without overselling. Sending the same order twice never creates two orders.
- **Super Admin** always sees the server's dealer list; dealer IDs are created by the server.
- A production build starts with no demo data. In development, demo data and demo logins are available.
- See `DEPLOY.md` for hosting, Docker, backups and the go-live checklist.

## Working with no signal (order takers)
- **Install once, with internet:** open My Saleflo on the phone, log in, and choose *Add to Home Screen / Install app*. The app is then saved on the phone and **opens with no signal**. (This needs the site to run over **HTTPS**.) Order takers stay signed in on their own phone for 30 days.
- **Take orders as usual.** The customers and products are the ones saved on the phone at the last sync. With no signal the order is saved on the phone and a **provisional slip** can be printed (it is clearly marked as not yet confirmed).
- **Invoice numbers.** With no signal there is no invoice number, only the provisional slip. As soon as an order is sent, the phone shows a green box "order sent — invoice numbers ready" with each real invoice number (it stays until dismissed, even if the app was closed), and the number also appears in *My Orders*.
- **Automatic sending.** When the signal returns the waiting orders are sent by themselves (or tap **Send now**). The server creates the real invoice, cuts the stock and updates the customer's account, and the order is dated when it was really taken. Sending the same order twice can never create two orders.
- **Stock safety.** Waiting orders hold their quantity back on that phone so it cannot oversell. If the dealer's stock has run out by the time the order is sent, the server refuses it and the order taker sees it under *not accepted* with the reason (he can try again or delete it). Nothing has been delivered at that point, so no stock goes negative.
- Orders still need the dealer to mark them delivered, as always.

## Order delivery and cancellation
- New orders start as **Pending**. In **Orders**, the dealer taps **Delivered** when the goods reach the shop (the AI Assistant's "Pending Orders" list uses this).
- **Cancel** works only for pending orders (not delivered ones): stock goes back to the shelf, the invoice is voided (shown as CANCELLED and no longer counted in sales, reports, dashboards or recovery), and the customer's balance drops by the invoice total. Money the shop had already paid stays as their advance credit. A reason can be recorded.
- A delivered order that comes back is handled with a **Sales Return**. An order that already has a sales return cannot be cancelled.
- Only the dealer can mark delivered or cancel; order takers see the status on their own orders.

## Passwords and sessions
- Everyone can change their own password from the **Password** button in the top bar (other devices are logged out).
- A forgotten **dealer** password is reset by the Super Admin (key icon in the dealer list); a forgotten **order taker** password is reset by the dealer (Order Takers screen).
- A forgotten **Super Admin** password: restart the server once with `RESET_SUPER_ADMIN_PASSWORD=1` and `SUPER_ADMIN_PASSWORD` set, then remove the reset variable.
- Logins are saved with the database, so a server restart no longer logs everyone out (saved sessions never contain a usable token).

## AI Assistant (Phase 12)
A chat-style **AI Assistant** is available to every role (Dealer menu, Order Taker "AI" tab, Super Admin "AI Assistant" tab). Users can tap the 8 quick questions (Today's Sales, This Month's Sales, Best-Selling Products, Low Stock, Pending Orders, Outstanding Payments, Recent Invoices, Sales Summary) or type their own question in English or Roman Urdu (for example "aaj ki bikri kitni hai", "Ali Store ka balance", "cola stock").

- **Real numbers only.** Every figure is calculated by the server from the dealer's saved data, using the same rules as the Reports screen (cancelled orders excluded, returns deducted, "today" and "this month" in `APP_TIMEZONE`). If the data does not contain something, the assistant says so instead of guessing.
- **Permissions follow the role.** A Dealer sees only their own data (the dealer ID comes from the login session, never from the question). An Order Taker gets the same safe view as their screen: own orders only, no buy prices, profit, expenses, returns, ledger or other order takers' performance. Super Admin can only ask platform questions (dealers, subscriptions, expiry dates) and is refused anything about a dealer's private business data.
- **Read-only.** The assistant has no tools that create, change or delete records. Questions such as "delete all orders" cannot change anything.
- **Secrets stay on the server.** Works out of the box with the built-in assistant (no key, no outside service). Optionally set `ANTHROPIC_API_KEY` to let a Claude model understand free-form questions; it can only call the same read-only tools and any problem falls back to the built-in assistant. Set `AI_MODE=builtin` to never call an outside service.
- 20 questions per minute per user; question text is not logged.
- "Data as of" under each answer shows when the dealer's data was last saved to the server.

## First-time setup in production
1. Start the server with `SUPER_ADMIN_PASSWORD` set; log in as `superadmin`.
2. Create a dealer (Super Admin). Give the dealer their username and password.
3. The dealer logs in, adds products and customers, then adds Order Takers (Order Takers menu).
4. The dealer's data is saved to the server automatically; order takers can now log in on their phones.
   (Order takers see "ask your dealer to open My Saleflo once" until the dealer has logged in at least once.)

## Known limitations
- An order taken with no signal gets a provisional slip, not an invoice. The real invoice number and the stock check happen when the order reaches the server.
- Dealer screens read a browser copy of the data that is refreshed from the server; two people editing as the dealer at the same moment is detected, not merged.
- Order taker live location and online/offline status are still recorded on the device only.
- Deleting a dealer in Super Admin does not delete that dealer's business data from the database.
