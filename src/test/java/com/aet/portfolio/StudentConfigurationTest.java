package com.aet.portfolio;

import com.aet.portfolio.config.SiteProperties;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import static org.assertj.core.api.Assertions.assertThat;

class StudentConfigurationTest {
    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(SiteProperties.class)
    static class Config {}

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
        .withUserConfiguration(Config.class)
        .withPropertyValues("site.students[0].id=s1", "site.students[0].name=Dinorobong Tubo",
            "site.students[0].row=1", "site.students[0].col=1");

    @Test void duplicateSeatsFailBinding() {
        runner.withPropertyValues("site.students[1].id=s2", "site.students[1].name=Diwata Pares",
            "site.students[1].row=1", "site.students[1].col=1")
            .run(context -> assertThat(context).hasFailed());
    }
    @Test void outOfRangeRowFailsBinding() {
        runner.withPropertyValues("site.students[0].row=5")
            .run(context -> assertThat(context).hasFailed());
    }
    @Test void viewerSeatFailsBinding() {
        runner.withPropertyValues("site.students[0].row=4", "site.students[0].col=2")
            .run(context -> assertThat(context).hasFailed());
    }
    @Test void newInnerSlotBinds() {
        runner.withPropertyValues("site.students[0].row=3", "site.students[0].col=3")
            .run(context -> assertThat(context).hasNotFailed());
    }
    @Test void absentSeatFailsBinding() {
        runner.withPropertyValues("site.students[0].row=4", "site.students[0].col=1")
            .run(context -> assertThat(context).hasFailed());
    }
    @Test void blankAbsentNameFailsBinding() {
        runner.withPropertyValues("site.classroom.absent-name= ")
            .run(context -> assertThat(context).hasFailed());
    }
    @Test void validSeatBinds() {
        runner.run(context -> assertThat(context).hasNotFailed());
    }
}
