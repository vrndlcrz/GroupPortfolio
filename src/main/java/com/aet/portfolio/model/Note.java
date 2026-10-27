package com.aet.portfolio.model;

public class Note {
    private String id;
    private int memberId;
    private String text;
    private String author;
    private long timestamp;

    public Note() {
    }

    public Note(String id, int memberId, String text, String author, long timestamp) {
        this.id = id;
        this.memberId = memberId;
        this.text = text;
        this.author = author;
        this.timestamp = timestamp;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public int getMemberId() {
        return memberId;
    }

    public void setMemberId(int memberId) {
        this.memberId = memberId;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String author) {
        this.author = author;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }
}
