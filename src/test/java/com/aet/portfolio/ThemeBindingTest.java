package com.aet.portfolio;

import com.aet.portfolio.config.SiteProperties;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import static org.assertj.core.api.Assertions.assertThat;

class ThemeBindingTest {
    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(SiteProperties.class)
    static class Config {}

    @ParameterizedTest
    @ValueSource(strings = { "-0.01", "1.01" })
    void rejectsOutOfRangeIntensity(String intensity) {
        new ApplicationContextRunner().withUserConfiguration(Config.class)
            .withPropertyValues("site.theme.golden-intensity=" + intensity)
            .run(context -> {
                assertThat(context).hasFailed();
                assertThat(context.getStartupFailure()).hasStackTraceContaining("goldenIntensity");
            });
    }

    @ParameterizedTest
    @ValueSource(strings = { "0.0", "1.0" })
    void acceptsBoundaryIntensity(String intensity) {
        new ApplicationContextRunner().withUserConfiguration(Config.class)
            .withPropertyValues("site.theme.golden-intensity=" + intensity)
            .run(context -> {
                assertThat(context).hasNotFailed();
                assertThat(context.getBean(SiteProperties.class).theme().goldenIntensity())
                    .isEqualTo(Double.parseDouble(intensity));
            });
    }
}
