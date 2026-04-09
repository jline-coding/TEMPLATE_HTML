(function () {
    /** Custom Column Chart ◁ */

    const CreateChart = (id, opts) => {
        const ctx = document.getElementById(id).getContext("2d");
        const options = {
            responsive: true,
            maintainAspectRatio: false,
            legend: {
                display: false,
            },
            tooltips: {
                enabled: false,
            },
            hover: {
                mode: null,
            },
            elements: {
                arc: {
                    borderWidth: 0,
                },
            },
            plugins: {
                datalabels: {
                    formatter: function (a, b) {
                        console.log(a, b);
                    },
                },
            },
        };
        opts.options = options;
        new Chart(ctx, opts);
    };

    const PieChartConfigs = {
        pie_chart: {
            type: "pie",
            data: {
                datasets: [
                    {
                        data: [48.75, 23.84, 19.22, 7.83, 0.36],
                        backgroundColor: ["#065A40", "#009F8A", "#268D55", "#0C6201", "#024119"],
                        borderColor: "#ffffff", 
                        borderWidth: 1.5, 
                    },
                ],
            },
        },
    };

    const HanldePieChartRender = () => {
        js_pie_chart.map((a, b) => {
            const _ = $(b);
            const decore = _.next(".pie_chart_decore");
            const chart_id = _.attr("data-chart-id");
            const data = PieChartConfigs[chart_id].data.datasets[0].data;

            let _html = "";
            for (const i of data) {
                _html += `<span>${i}<i>%</i></span>`;
            }
            decore.html(_html);
        });
    };
    const HanldePieChartState = () => {
        const { scrollY, innerHeight } = window;
        js_pie_chart.map((a, b) => {
            const _ = $(b);
            const top = _.offset().top;
            const check = _.hasClass("run");
            if (top < scrollY + innerHeight * 0.8 && !check) {
                const chart_id = _.attr("data-chart-id");
                CreateChart(chart_id, PieChartConfigs[chart_id]);
                _.addClass("run");
                _.parent().addClass("run");
            }
        });
    };

    /** ▷ Odometer */
    const HanldeOdometerState = () => {
        odometer.map((a, b) => {
            const _ = $(b);
            const { scrollY, innerHeight } = window;

            if (_.offset().top < scrollY + innerHeight * 0.8 && !_.hasClass("run")) {
                let _num = +_.attr("data-num");
                _.text(_num);
                _.addClass("run");
            }
        });
    };
    /** Odometer ◁ */
    const js_pie_chart = $(".js_pie_chart");
    const odometer = $(".odometer");

    $(window).on("load", function () {
        // -- ▷ render
        HanldePieChartRender();

        // -- ▷ set state
        HanldePieChartState();

        HanldeOdometerState();
    });
    $(window).on("scroll", function () {
        HanldePieChartState();

        HanldeOdometerState();
    });
})();
