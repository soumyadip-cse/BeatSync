# FFT and frequency mapping

## Scope

Document sample rate, FFT size, bin spacing, frequency ranges, and the conversion from bins to named bands. Keep raw spectrum analysis separate from the lighting mapper.

## Starting facts from the project context

For an FFT of size `N` at sample rate `fs`, approximate bin spacing is `fs / N`, and bin `k` is centered near `k * fs / N`. Verify runtime sample rate and implementation details rather than hard-coding the example values from the brief.

## Open questions

- Which FFT size balances frequency resolution and response time?
- Should band boundaries be logarithmic or linear?
- How are bins below the first useful bass bin and above the audible range handled?
- Should each band use a mean, sum, peak, or another statistic?
- What normalization avoids both quiet-song deadness and clipping?

No FFT code or final band definitions are implemented here.
