# Livestock Oracle

## Summary

KYCRegistry – identity / roles.

AnimalPassportRegistry – per-animal identity + private data anchor.

SpeciesToken – fungible species units as collateral.

SpeciesOracle – AI-fed species prices (and later scores).

SpeciesLending – loans backed by species tokens.

CooperativeAttestor – co-op-based credit signals.

GrantVoucherRegistry – future grant commitments as NFTs.

GuaranteePool – where grant money actually eats losses.

---

1. KYCRegistry

File: KYCRegistry.sol
Type: Global identity and roles registry

Purpose

Single source of truth for who is allowed to do what in the protocol:

Who is KYCed at all.

Who can borrow, act as a bank, cooperative, oracle bot, or grantor.

Core data

```bash

```

Key functions

Admin:

setKYCStatus(user, bool) – mark an address as KYCed / not.

setUserRoles(user, borrower, bank, coop, oracleBot, grantor) – batch-assign roles.

Convenience setters: setBorrower, setBank, setCoop, setOracleBot, setGrantor.

Views (used by other contracts):

isKYCed(user)

isBorrower(user)

isBank(user)

isCoop(user)

isOracleBot(user)

isGrantor(user)

getFlags(user) – returns all flags.

How it fits the platform

Everything else reads this:

AnimalPassportRegistry checks isKYCed(owner) before minting a passport.

CooperativeAttestor checks isCoop(coop) and isKYCed(farmer).

GrantVoucherRegistry checks isGrantor(grantor) and isKYCed(beneficiary).

GuaranteePool checks isGrantor for depositors.

(Optional / next step) SpeciesLending can gate deposit/borrow/repay/liquidate to isBorrower(user) and KYCed wallets.

(Optional) SpeciesOracle can ensure price reporters are isOracleBot.

This is the compliance spine of the whole system.

---

2. SpeciesToken

File: SpeciesToken.sol
Type: ERC1155 fungible token per species

Purpose

Fungible representation of standardized animal units (e.g. “1 cow unit”, “1 pig unit”) per species. This is what the lending protocol uses as collateral tokens.

Core data

Key functions

Admin / species management:

\_registerSpecies(id, name, unitDecimals, mintPaused) – internal initializer.

setSpeciesInfo(id, name, unitDecimals, mintPaused) – create or update species by fixed id.

registerNewSpecies(name, unitDecimals, mintPaused) – auto-assign new species id.

setMintPaused(id, paused) – pause/unpause minting for that species.

setURI(newUri) – update base metadata URI.

Mint / burn:

mint(to, id, amount, data) – only MINTER_ROLE, only for existing species, and only if mintPaused == false.

burn(from, id, amount) – called by owner or approved operator.

How it fits the platform

Collateral layer:
Farmers (or their co-ops) hold SpeciesToken balances that represent standardized animal units. They deposit these into SpeciesLending as collateral.

Link to AnimalPassport:
AnimalPassportRegistry links each passport to a speciesId. You can optionally give AnimalPassportRegistry the MINTER_ROLE so that every minted passport auto-mints the corresponding SpeciesToken unit.

---

3. SpeciesOracle

File: SpeciesOracle.sol
Type: AI-fed species price oracle

Purpose

Provide USD price per species (cow/pig/goat/chicken) based on AI / oracle bots.

It doesn’t know individual animals; it knows species-level price, which SpeciesLending uses to compute collateral value.

Core data

Key functions

Config & roles:

setConfig(id, heartbeat, maxDeviationBps, paused) – admin sets per-species oracle config.

grantReporter(address) – admin adds reporters (AI bots).

accept(id) – guardian locks in the median as lastAcceptedPrice.

Reporting:

postPrice(id, price) – reporters push prices to ring buffer.

Reading:

currentPrice(id) → (price, timestamp, valid):

Collects observations.

Requires at least 3.

Checks heartbeat (freshness).

Takes median.

Enforces max deviation from lastAcceptedPrice.

How it fits the platform

AI + data layer:
Off-chain AI agents compute species prices (based on market data, slaughter prices, local conditions) and post via postPrice.

Lending layer:
SpeciesLending calls oracle.currentPrice(speciesId) to convert user’s deposited SpeciesToken amounts into USD value in order to calculate:

borrow capacity (LTV),

liquidation threshold,

liquidation amount.

Later you can extend this oracle to also store:

per-animal valuations, and

credit scores,

but the current version is already correct and usable.

---

4. AnimalPassportRegistry

File: AnimalPassportRegistry.sol
Type: ERC721 “passports” per individual animal

Purpose

Create one NFT per animal (cow, pig, goat, chicken) with:

link to its species,

zk / off-chain metadata,

last valuation timestamp, and

collateralization status.

This is the identity layer for each animal, separate from the fungible SpeciesToken.

Core data

Key functions

mintPassport(owner, speciesId, metadataHash) – only REGISTRAR_ROLE:

Checks kyc.isKYCed(owner).

Mints ERC721 to owner.

Writes AnimalData.

updateValuation(id, newVal) – only REGISTRAR_ROLE:

Updates lastValuation + timestamp.

setCollateralStatus(id, locked) – only REGISTRAR_ROLE:

Marks whether the animal is currently pledged as collateral.

How it fits the platform

Identity layer:
Every individual animal has a passport NFT, with private data off-chain (or via zk). This is what your AI uses to:

adjust valuations beyond species-level (age, health, genetics, location),

track historical performance / mortality / health.

Bridge to pooled collateral:
For now, lending is based on pooled SpeciesToken balances. The passport data feeds the AI, which then refines risk parameters and valuations posted into SpeciesOracle.

Later you can:

enforce 1:1 mapping between passports and SpeciesToken units,

or lock passports directly in a per-animal lending contract.

---

5. SpeciesLending

File: SpeciesLending.sol
Type: Lending pool against species-level collateral

Purpose

Main credit engine:

Farmers deposit species tokens (SpeciesToken) as collateral.

Borrow in a stable ERC20 (6 decimals) up to a per-species LTV.

AI oracle provides the prices; risk config sets LTV, thresholds, bonuses.

Core data

---

Key functions

Admin:

setRisk(id, Risk) – sets per-species LTV, liq threshold, liq bonus, cap.

User actions:

deposit(id, amount) – move species tokens from user → contract; update col.

withdraw(id, amount) – reduce col, require health factor ≥ 1.0 after withdrawal.

borrow(amt6) – increase debt, require borrowable(user) ≥ amt6, send stable.

repay(amt6) – pull stable from user, reduce debt.

Liquidation:

liquidate(user, speciesId, repayAmt6):

Require health factor < 1.0 (undercollateralized).

Pull stable from liquidator.

Use SpeciesOracle.currentPrice to calculate seizure amount with liqBonusBps.

Transfer seized collateral to liquidator.

Reduce user debt by repayAmt6.

Views:

borrowable(user) – how much more they can borrow in stable.

health(user) – health factor (1e18 = 1.0).

\_values(user) – internal; sums collateral values over species 1–4 in USD (6 decimals) based on oracle prices and per-species risk params.

How it fits the platform

Collateral → Credit:
Converts SpeciesToken balances into USD value using SpeciesOracle.
Then controls how much users can borrow and when they get liquidated.

Interaction order:

Farmer obtains animals (optionally gets them as SpeciesToken from Passport or a coop).

Farmer deposits SpeciesToken into SpeciesLending.

AI oracle posts species prices.

Contract calculates borrow capacity, user borrows stable.

GuaranteePool can later plug in to cover part of losses on default (extension).

---

6. CooperativeAttestor

File: CooperativeAttestor.sol
Type: On-chain coop reputation / membership registry

Purpose

Let cooperatives attest to their farmers’ behavior and performance:

Are they active members?

Deliveries over last 6 months?

Are they in good standing?

Co-op rating of this farmer?

This becomes a strong credit signal for the AI and banks.

Core data

Key functions

Admin:

registerCoop(coop) – only COOP_ADMIN_ROLE, requires kyc.isCoop(coop).

revokeCoop(coop) – remove coop from allowed attestors.

Coop actions (only COOP_ROLE):

setMembership(farmer, active, deliveries6m, goodStanding, rating):

Farmer must be KYCed.

Updates memberships[farmer][coop].

Views:

getMembership(farmer, coop) – returns the struct.

isAuthorizedCoop(coop) – check if coop is allowed here.

isFarmerInGoodStanding(farmer, coop) – convenience for AI/risk logic.

How it fits the platform

Social / productivity layer:
This is where the platform captures non-price information:

A coop that knows the farmer can attest they deliver regularly, pay internal obligations, etc.

AI / oracle usage:

Off-chain AI reads these attestions and uses them in:

credit scoring,

deciding discounts on interest,

setting risk flags by region/coop.

---

7. GuaranteePool

File: GuaranteePool.sol
Type: Grant-backed first-loss buffer

Purpose

Turn grant money into a first-loss guarantee for a portfolio of loans in SpeciesLending.

This is how grants become “liquid” in a serious way: they absorb losses, making banks comfortable to lend more / cheaper.

Core data

Key functions

Admin:

setLendingContract(address) – sets which lending contract can use the pool.

withdrawUncommitted(to, amount) – admin can only pull uncommitted capital.

Grantor interactions:

depositGrant(amount) – only KYCed isGrantor addresses can deposit stable tokens.

Lending contract interactions (onlyLending):

registerLoan(loanId, guaranteeAmount):

Reserves guarantee for that loan.

Increases totalCommitted.

coverLoss(loanId, lossAmount):

On default, pool pays up to remainingGuarantee.

Decreases remainingGuarantee + totalCommitted.

Transfers to lending contract.

deactivateLoan(loanId):

Frees up remaining guarantee if loan repaid / cancelled.

Views:

poolBalance() – ERC20 balance.

uncommittedBalance() – free capital that isn’t reserved yet.

getLoanGuarantee(loanId) – returns details.

How it fits the platform

Risk-sharing layer:

Donors / grantors deposit stable.

SpeciesLending registers eligible loans with a guarantee portion.

On real losses, GuaranteePool pays first before LPs or banks absorb losses.

This lets you say: “Every $1 of grant capital supports $3–5 of lending” in a non-degen way.

---

8. GrantVoucherRegistry

File: GrantVoucherRegistry.sol
Type: ERC721 NFTs representing future grant cashflows

Purpose

Tokenize commitments to pay grants to farmers (or protocol users). Each NFT = one grant voucher that can be used as soft collateral or to control future flow of funds.

Core data

Key functions

Minting:

mintVoucher(beneficiary, notionalAmount, expectedPayoutDate, grantRef):

Caller must be isGrantor and KYCed.

Beneficiary must be KYCed (and optionally isBorrower).

Mints ERC721 to beneficiary.

Creates GrantVoucherData with Pending status.

Status updates (grantor or admin only):

markFunded(tokenId) – move Pending → Funded.

markCancelled(tokenId) – Pending/Funded → Cancelled.

markPaid(tokenId) – Funded → Paid.

Admin:

adminUpdateBeneficiary(tokenId, newBeneficiary) – change NFT owner/beneficiary before Paid/Cancelled (for migrations or corrections).

Views:

getVoucher(tokenId) – full struct.

grantorOf(tokenId) / beneficiaryOf(tokenId) / statusOf(tokenId).

How it fits the platform

Soft collateral & cashflow control:

If a farmer has a grant approved, the grantor issues a voucher NFT.

The AI & lending protocol can treat Funded vouchers as:

improving PD/LGD assumptions,

or providing additional coverage (e.g. grant funds will go to repay loans).

In a later iteration:

You can implement lockToLoan(voucherId, loanId) and route the actual grant payment into the loan or guarantee pool.

This is how you represent expected grant cashflows in a structured, on-chain way.

---

How everything works together (order & relationships)
Roles

Farmer / livestock owner – holds animals, wants loans.

Co-op – organizes farmers, provides attestations.

Bank / LP – provides liquidity to lending pool.

Grantor – donor / institution providing grants.

Oracle bot / AI – feeds prices (and later scores).

Protocol admin – sets risk parameters, registers coops, etc.

Initialization / deployment order

Deploy KYCRegistry.

Onboard addresses with roles:

Mark farmers as kyc + borrower.

Mark banks as kyc + bank.

Mark co-ops as kyc + coop.

Mark oracle bot as kyc + oracleBot.

Mark donors as kyc + grantor.

Deploy SpeciesToken and initialize base species (cow, pig, goat, chicken).

Deploy SpeciesOracle and configure:

Add AI reporters (with REPORTER_ROLE, ideally checking KYCRegistry).

Set per-species heartbeat & maxDeviation.

Deploy SpeciesLending with:

stable ERC20,

SpeciesToken,

SpeciesOracle,

owner\_ (admin).

Then set risk params for each species using setRisk.

Deploy AnimalPassportRegistry with:

IKYCRegistry,

SpeciesToken.

Deploy CooperativeAttestor with:

IKYCRegistry,

admin.

Register co-ops via registerCoop.

Deploy GrantVoucherRegistry with:

IKYCRegistry,

admin.

Deploy GuaranteePool with:

stable token,

IKYCRegistry,

admin,

then set lending contract via setLendingContract(address SpeciesLending).

Runtime flow for a farmer getting a loan

Onboarding & identity

Farmer is KYCed → KYCRegistry.setKYCStatus + setBorrower.

If part of a coop, coop calls setMembership in CooperativeAttestor.

Animal registration

Registrar mints passports: AnimalPassportRegistry.mintPassport(farmer, speciesId, metadataHash).

(Optional) Passport contract mints SpeciesToken units to the farmer.

AI valuation & credit evaluation

AI reads:

Passports (off-chain metadata),

Co-op attestations,

Species market data,

Past on-chain repayment behavior.

AI posts species prices → SpeciesOracle.postPrice(speciesId, price).

(Later) AI can post per-animal valuations & credit scores if you extend the oracle.

Farmer posts collateral

Farmer approves and calls SpeciesLending.deposit(speciesId, amount).

SpeciesLending stores col[farmer][speciesId] += amount.

Loan origination

Farmer calls borrow(amount):

Contract computes \_borrowable(farmer) using:

col[farmer][id],

SpeciesOracle.currentPrice(id),

risk[id].ltvBps.

If OK, debt[farmer] += amount and transfer stable.

If GuaranteePool is integrated:

SpeciesLending registers the new loan there with registerLoan(loanId, guaranteeAmount).

During the loan

AI periodically updates SpeciesOracle prices and, later, credit scores.

Co-ops update setMembership if deliveries change.

Vet data & AnimalPassport valuations can be refreshed (off-chain → AI → Oracle).

Repayment

Farmer repays via SpeciesLending.repay(amount).

Debt reduces; once debt == 0, farmer can withdraw all collateral.

Default & loss

If prices drop or farmer doesn’t repay, health factor falls < 1.0.

Liquidators can call liquidate(user, speciesId, repayAmt6):

They pay stable to the protocol and get seized collateral with a bonus.

If, after liquidation, there is still a shortfall:

SpeciesLending (in an extended version) would call GuaranteePool.coverLoss(loanId, lossAmount).

GuaranteePool pays out to lending contract up to remaining guarantee.

Grants

Grantor issues a voucher: GrantVoucherRegistry.mintVoucher(farmer, amount, payoutDate, grantRef).

This voucher:

Signals future cashflow to the AI & banks.

Can be linked to loans in a future iteration (e.g., part of the grant auto-repays the loan or refills GuaranteePool).

```

```
