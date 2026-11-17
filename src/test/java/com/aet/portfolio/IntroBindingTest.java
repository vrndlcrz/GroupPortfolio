package com.aet.portfolio;

import com.aet.portfolio.config.SiteProperties;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import static org.assertj.core.api.Assertions.assertThat;

class IntroBindingTest {
    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(SiteProperties.class)
    static class Config {}

    @Test
    void rejectsBlankTitle() {
        new ApplicationContextRunner().withUserConfiguration(Config.class)
            .withPropertyValues("site.intro.title=   ")
            .run(context -> {
                assertThat(context).hasFailed();
                assertThat(context.getStartupFailure()).hasStackTraceContaining("title")
                    .hasStackTraceContaining("must not be blank");
            });
    }
}
