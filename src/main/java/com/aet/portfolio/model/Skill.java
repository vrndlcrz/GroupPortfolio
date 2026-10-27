package com.aet.portfolio.model;

public class Skill {
    private String name;
    private int level;
    private String funnyLabel;

    public Skill() {
    }

    public Skill(String name, int level, String funnyLabel) {
        this.name = name;
        this.level = level;
        this.funnyLabel = funnyLabel;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getLevel() {
        return level;
    }

    public void setLevel(int level) {
        this.level = level;
    }

    public String getFunnyLabel() {
        return funnyLabel;
    }

    public void setFunnyLabel(String funnyLabel) {
        this.funnyLabel = funnyLabel;
    }
}
