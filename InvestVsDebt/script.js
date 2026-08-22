(function () {
  'use strict';

  var els = {
    debtBalance: document.getElementById('debt-balance'),
    debtRate: document.getElementById('debt-rate'),
    debtPayment: document.getElementById('debt-payment'),
    debtWarning: document.getElementById('debt-warning'),
    investBalance: document.getElementById('invest-balance'),
    investRate: document.getElementById('invest-rate'),
    investContribution: document.getElementById('invest-contribution'),
    rollOver: document.getElementById('roll-over'),
    years: document.getElementById('years'),
    yearsValue: document.getElementById('years-value'),
    maximizeBtn: document.getElementById('maximize-btn'),
    maximizeBudget: document.getElementById('maximize-budget'),
    maximizeYears: document.getElementById('maximize-years'),
    maximizeResult: document.getElementById('maximize-result'),
    summaryYears: document.getElementById('summary-years'),
    summaryNetworth: document.getElementById('summary-networth'),
    summaryDebtfree: document.getElementById('summary-debtfree'),
    summaryInterest: document.getElementById('summary-interest'),
    summaryGrowth: document.getElementById('summary-growth'),
    form: document.getElementById('calc-form')
  };

  var currency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });

  var css = getComputedStyle(document.documentElement);
  var colors = {
    debt: css.getPropertyValue('--debt').trim(),
    debtSoft: css.getPropertyValue('--debt-soft').trim(),
    growth: css.getPropertyValue('--growth').trim(),
    growthSoft: css.getPropertyValue('--growth-soft').trim(),
    brass: css.getPropertyValue('--brass').trim(),
    brassBright: css.getPropertyValue('--brass-bright').trim(),
    ink3: css.getPropertyValue('--ink-3').trim(),
    textPaper: css.getPropertyValue('--text-on-paper').trim(),
    textPaperDim: css.getPropertyValue('--text-on-paper-dim').trim(),
    paper: css.getPropertyValue('--paper').trim()
  };

  function num(el, fallback) {
    var v = parseFloat(el.value);
    return isFinite(v) && v >= 0 ? v : fallback;
  }

  function readInputs() {
    return {
      debtBalance: num(els.debtBalance, 0),
      debtRate: num(els.debtRate, 0),
      debtPayment: num(els.debtPayment, 0),
      investBalance: num(els.investBalance, 0),
      investRate: num(els.investRate, 0),
      investContribution: num(els.investContribution, 0),
      years: parseInt(els.years.value, 10) || 1,
      rollOver: els.rollOver.checked
    };
  }

  function computeSeries(inputs) {
    var months = inputs.years * 12;
    var monthlyDebtRate = inputs.debtRate / 100 / 12;
    var monthlyInvestRate = inputs.investRate / 100 / 12;

    var debt = inputs.debtBalance;
    var invest = inputs.investBalance;
    var debtFreeMonth = debt <= 0 ? 0 : null;
    var totalInterest = 0;
    var contributionsSum = 0;

    var debtSeries = [{ x: 0, y: debt }];
    var investSeries = [{ x: 0, y: invest }];
    var netSeries = [{ x: 0, y: invest - debt }];

    for (var m = 1; m <= months; m++) {
      if (debt > 0) {
        var interest = debt * monthlyDebtRate;
        totalInterest += interest;
        debt = debt + interest - inputs.debtPayment;
        if (debt <= 0) {
          debt = 0;
          if (debtFreeMonth === null) debtFreeMonth = m;
        }
      }

      var contribution = inputs.investContribution;
      if (inputs.rollOver && debt === 0 && debtFreeMonth !== null) {
        contribution += inputs.debtPayment;
      }
      invest = invest * (1 + monthlyInvestRate) + contribution;
      contributionsSum += contribution;

      debtSeries.push({ x: m / 12, y: debt });
      investSeries.push({ x: m / 12, y: invest });
      netSeries.push({ x: m / 12, y: invest - debt });
    }

    var growthEarned = invest - inputs.investBalance - contributionsSum;
    var initialMonthlyInterest = inputs.debtBalance * monthlyDebtRate;
    var warning = inputs.debtBalance > 0 && inputs.debtPayment <= initialMonthlyInterest;

    return {
      debtSeries: debtSeries,
      investSeries: investSeries,
      netSeries: netSeries,
      debtFreeMonth: debtFreeMonth,
      totalInterest: totalInterest,
      growthEarned: growthEarned,
      finalNet: invest - debt,
      warning: warning,
      years: inputs.years
    };
  }

  // Searches how a fixed monthly budget should split between debt payment
  // and investment contribution to maximize net worth at the chosen horizon.
  // Debt and investments compound independently of each other, so net worth
  // is (near-enough) a single-peaked function of the split — a coarse-then-fine
  // grid search over computeSeries finds the peak without assuming a formula,
  // and stays exactly consistent with what the chart itself shows.
  function findOptimalSplit(inputs, budget) {
    function netWorthFor(debtPayment) {
      var trial = Object.assign({}, inputs, {
        debtPayment: debtPayment,
        investContribution: budget - debtPayment
      });
      return computeSeries(trial).finalNet;
    }

    var bestP = 0;
    var bestNet = -Infinity;
    var coarseSteps = 240;
    for (var i = 0; i <= coarseSteps; i++) {
      var p = (budget * i) / coarseSteps;
      var net = netWorthFor(p);
      if (net > bestNet) { bestNet = net; bestP = p; }
    }

    var radius = budget / coarseSteps;
    var fineSteps = 40;
    for (var j = -fineSteps; j <= fineSteps; j++) {
      var pf = Math.min(budget, Math.max(0, bestP + (radius * j) / fineSteps));
      var netf = netWorthFor(pf);
      if (netf > bestNet) { bestNet = netf; bestP = pf; }
    }

    bestP = Math.round(bestP);
    return {
      debtPayment: bestP,
      investContribution: Math.max(0, budget - bestP),
      finalNet: netWorthFor(bestP)
    };
  }

  function runMaximize() {
    var inputs = readInputs();
    var budget = inputs.debtPayment + inputs.investContribution;
    if (budget <= 0) {
      els.maximizeResult.textContent = 'Enter a monthly payment or contribution first — there’s nothing to split yet.';
      els.maximizeResult.hidden = false;
      els.maximizeResult.classList.add('maximize-result--warn');
      return;
    }

    var before = computeSeries(inputs).finalNet;
    var optimal = findOptimalSplit(inputs, budget);

    els.debtPayment.value = optimal.debtPayment;
    els.investContribution.value = optimal.investContribution;

    var monthlyDebtRate = inputs.debtRate / 100 / 12;
    var initialInterest = inputs.debtBalance * monthlyDebtRate;
    var leavesDebtUnserviced = inputs.debtBalance > 0 && optimal.debtPayment <= initialInterest && optimal.debtPayment < optimal.investContribution;

    var nearAllThreshold = budget * 0.03;
    var favor;
    if (optimal.investContribution >= budget - nearAllThreshold) favor = 'investing beats the loan’s rate';
    else if (optimal.debtPayment >= budget - nearAllThreshold) favor = 'the loan’s rate beats investing';
    else favor = 'the rates are close enough that a mixed split wins';

    var delta = optimal.finalNet - before;
    var deltaText = delta >= 0
      ? 'up ' + currency.format(delta) + ' from the current split'
      : currency.format(Math.abs(delta)) + ' lower than the current split (already close to optimal)';

    var msg = '$' + optimal.debtPayment + '/mo to debt, $' + optimal.investContribution +
      '/mo to investing — ' + favor + '. Projected net worth: <strong>' +
      currency.format(optimal.finalNet) + '</strong> (' + deltaText + ').';

    if (leavesDebtUnserviced) {
      msg += ' Note: that leaves the loan’s interest uncovered, so its balance grows for the whole horizon — real loans usually require a minimum payment this ignores.';
    }

    els.maximizeResult.innerHTML = msg;
    els.maximizeResult.hidden = false;
    els.maximizeResult.classList.toggle('maximize-result--warn', leavesDebtUnserviced);

    [els.debtPayment, els.investContribution].forEach(function (input) {
      var row = input.closest('.field-input-row');
      row.classList.remove('flash');
      void row.offsetWidth;
      row.classList.add('flash');
    });

    render();
  }

  function formatDebtFree(m) {
    if (m === null) return 'Beyond horizon';
    if (m === 0) return 'Already';
    var y = Math.floor(m / 12);
    var mm = m % 12;
    if (mm === 0) return y + ' yr' + (y === 1 ? '' : 's');
    if (y === 0) return mm + ' mo';
    return y + 'y ' + mm + 'm';
  }

  // Custom plugin: draws the "debt-free" crossover marker, ledger-annotation style.
  var crossoverPlugin = {
    id: 'crossoverMarker',
    afterDatasetsDraw: function (chart) {
      var month = chart.$debtFreeMonth;
      if (month === null || month === undefined || month === 0) return;
      var xScale = chart.scales.x;
      var yScale = chart.scales.y;
      var xYear = month / 12;
      if (xYear < xScale.min || xYear > xScale.max) return;

      var xPixel = xScale.getPixelForValue(xYear);
      var ctx = chart.ctx;
      var top = yScale.getPixelForValue(yScale.max);
      var bottom = yScale.getPixelForValue(yScale.min);

      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = colors.brass;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xPixel, top);
      ctx.lineTo(xPixel, bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      var label = 'Debt-free';
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      var textWidth = ctx.measureText(label).width;
      var padX = 6, padY = 4;
      var boxW = textWidth + padX * 2;
      var boxH = 18;
      var boxX = Math.min(Math.max(xPixel - boxW / 2, xScale.left), xScale.right - boxW);
      var boxY = top + 6;

      ctx.fillStyle = colors.brass;
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.fillStyle = colors.paper;
      ctx.textBaseline = 'middle';
      ctx.fillText(label, boxX + padX, boxY + boxH / 2 + 1);
      ctx.restore();
    }
  };

  // Custom plugin: a faint zero-line so a negative net worth reads clearly.
  var zeroLinePlugin = {
    id: 'zeroLine',
    beforeDatasetsDraw: function (chart) {
      var yScale = chart.scales.y;
      if (yScale.min >= 0) return;
      var yPixel = yScale.getPixelForValue(0);
      var ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = colors.textPaperDim;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chart.scales.x.left, yPixel);
      ctx.lineTo(chart.scales.x.right, yPixel);
      ctx.stroke();
      ctx.restore();
    }
  };

  var ctx = document.getElementById('chart').getContext('2d');
  var chart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Debt balance',
          data: [],
          borderColor: colors.debt,
          backgroundColor: colors.debt,
          borderDash: [5, 3],
          borderWidth: 1.75,
          pointRadius: 0,
          tension: 0
        },
        {
          label: 'Investments',
          data: [],
          borderColor: colors.growth,
          backgroundColor: colors.growth,
          borderWidth: 1.75,
          pointRadius: 0,
          tension: 0
        },
        {
          label: 'Net worth',
          data: [],
          borderColor: colors.brass,
          backgroundColor: colors.brass,
          borderWidth: 3,
          pointRadius: 0,
          tension: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 30 } },
      scales: {
        x: {
          type: 'linear',
          title: { display: false },
          grid: { color: 'rgba(27,36,48,0.08)' },
          ticks: {
            color: colors.textPaperDim,
            font: { family: "'IBM Plex Mono', monospace", size: 11 },
            stepSize: 1,
            callback: function (v) { return 'Y' + Math.round(v); }
          }
        },
        y: {
          grid: { color: 'rgba(27,36,48,0.08)' },
          ticks: {
            color: colors.textPaperDim,
            font: { family: "'IBM Plex Mono', monospace", size: 11 },
            callback: function (v) {
              return (v < 0 ? '-$' : '$') + Math.abs(v / 1000).toFixed(0) + 'k';
            }
          }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            color: colors.textPaper,
            usePointStyle: true,
            pointStyle: 'line',
            boxWidth: 24,
            font: { family: "'IBM Plex Sans', sans-serif", size: 12 }
          }
        },
        tooltip: {
          backgroundColor: colors.textPaper,
          titleFont: { family: "'IBM Plex Mono', monospace", size: 11 },
          bodyFont: { family: "'IBM Plex Mono', monospace", size: 12 },
          padding: 10,
          callbacks: {
            title: function (items) {
              return 'Year ' + items[0].parsed.x.toFixed(1);
            },
            label: function (item) {
              return item.dataset.label + ': ' + currency.format(item.parsed.y);
            }
          }
        }
      }
    },
    plugins: [crossoverPlugin, zeroLinePlugin]
  });

  function render() {
    var inputs = readInputs();
    var result = computeSeries(inputs);

    chart.data.datasets[0].data = result.debtSeries;
    chart.data.datasets[1].data = result.investSeries;
    chart.data.datasets[2].data = result.netSeries;
    chart.options.scales.x.min = 0;
    chart.options.scales.x.max = inputs.years;
    chart.$debtFreeMonth = result.debtFreeMonth;
    chart.update('none');

    els.debtWarning.hidden = !result.warning;

    els.summaryYears.textContent = inputs.years;
    els.summaryNetworth.textContent = currency.format(result.finalNet);
    els.summaryDebtfree.textContent = formatDebtFree(result.debtFreeMonth);
    els.summaryInterest.textContent = currency.format(result.totalInterest);
    els.summaryGrowth.textContent = currency.format(result.growthEarned);

    els.maximizeBudget.textContent = inputs.debtPayment + inputs.investContribution;
    els.maximizeYears.textContent = inputs.years;
  }

  els.years.addEventListener('input', function () {
    els.yearsValue.textContent = els.years.value;
  });

  els.form.addEventListener('input', function () {
    els.maximizeResult.hidden = true;
    render();
  });

  els.maximizeBtn.addEventListener('click', runMaximize);

  render();
})();
